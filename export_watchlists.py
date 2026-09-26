#!/usr/bin/env python3
"""
Export watchlists and stocks from the macOS/iOS Stocks app.

Requires Full Disk Access for Terminal (System Settings → Privacy & Security →
Full Disk Access).

Primary data source — the local mirror of the CloudKit private database:
  ~/Library/Group Containers/group.com.apple.stocks/Library/Documents/
      PrivateData/com.apple.stocks.private-production-dbstore.json

Each watchlist is a CKRecord (base64 NSKeyedArchiver bplist) whose `name` and
`symbols` fields are stored as plaintext protobuf despite the CKEncrypted*
class names. A WatchlistOrder record gives the app's dropdown ordering.

Stock metadata (company name, exchange, price, …) is enriched from the app's
cached quote API responses in the main container.

Output: <output-dir>/watchlists/ with one file per watchlist (json/csv/md)
plus index.json and README.md. Filenames are stable slugs so re-exports are
diff-friendly.
"""

import argparse
import base64
import json
import plistlib
import re
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
SCRIPT_DIR = Path(__file__).resolve().parent

GROUP_CONTAINER = HOME / "Library/Group Containers/group.com.apple.stocks"
DBSTORE_CANDIDATES = [
    GROUP_CONTAINER / "Library/Documents/PrivateData/com.apple.stocks.private-production-dbstore.json",
    GROUP_CONTAINER / "Library/Documents/PrivateData/com.apple.stocks.private-sandbox-dbstore.json",
]

MAIN_CONTAINER = HOME / "Library/Containers/com.apple.stocks/Data"
FS_CACHE_DIR = MAIN_CONTAINER / "Library/Caches/com.apple.stocks/fsCachedData"
MAIN_PLIST = MAIN_CONTAINER / "Library/Preferences/com.apple.stocks.plist"

ENV_FILE = SCRIPT_DIR / ".env"

# NSDate epoch (2001-01-01) → Unix epoch offset
NSDATE_EPOCH_OFFSET = 978307200


# ── Protobuf helpers ───────────────────────────────────────────────────────────

def _parse_varint(buf: bytes, pos: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            return result, pos
        shift += 7


def _parse_proto_strings(buf: bytes) -> list[str]:
    """Extract all length-delimited (wire type 2) fields as UTF-8 strings."""
    out = []
    pos = 0
    while pos < len(buf):
        try:
            tag, pos = _parse_varint(buf, pos)
            wire = tag & 7
            if wire == 2:
                length, pos = _parse_varint(buf, pos)
                out.append(buf[pos : pos + length].decode("utf-8", errors="replace"))
                pos += length
            elif wire == 0:
                _, pos = _parse_varint(buf, pos)
            else:
                break
        except (IndexError, UnicodeDecodeError):
            break
    return out


# ── CKRecord parsing ───────────────────────────────────────────────────────────

def _resolve(objects: list, ref):
    """Resolve a plistlib.UID reference into its object."""
    if isinstance(ref, plistlib.UID):
        return objects[ref.data]
    return ref


def _parse_ck_record(rec_b64: str) -> dict:
    """
    Decode one base64 NSKeyedArchiver CKRecord and extract watchlist fields.

    Returns {record_type, record_id, name, symbols, created, modified, device}.
    """
    raw = base64.b64decode(rec_b64)
    plist = plistlib.loads(raw)
    objects = plist["$objects"]

    result = {
        "record_type": None,
        "record_id": None,
        "name": None,
        "symbols": [],
        "created": None,
        "modified": None,
        "device": None,
    }

    # The root CKRecord dict is the one holding RecordType / RecordID keys
    root = None
    for o in objects:
        if isinstance(o, dict) and "RecordType" in o and "RecordID" in o:
            root = o
            break
    if root is None:
        return result

    result["record_type"] = _resolve(objects, root["RecordType"])

    record_id_obj = _resolve(objects, root["RecordID"])
    if isinstance(record_id_obj, dict) and "RecordName" in record_id_obj:
        result["record_id"] = _resolve(objects, record_id_obj["RecordName"])

    for src_key, dst_key in (("RecordCtime", "created"), ("RecordMtime", "modified")):
        date_obj = _resolve(objects, root.get(src_key))
        if isinstance(date_obj, dict) and "NS.time" in date_obj:
            ts = float(date_obj["NS.time"]) + NSDATE_EPOCH_OFFSET
            result[dst_key] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

    device = _resolve(objects, root.get("ModifiedByDevice"))
    if isinstance(device, str):
        result["device"] = device

    # Walk NS.keys/NS.objects dicts looking for CKEncryptedData fields
    for o in objects:
        if not (isinstance(o, dict) and "NS.keys" in o and "NS.objects" in o):
            continue
        keys = [_resolve(objects, u) for u in o["NS.keys"]]
        vals = [_resolve(objects, u) for u in o["NS.objects"]]
        for k, v in zip(keys, vals):
            if not (isinstance(k, str) and isinstance(v, dict) and "EncryptedData" in v):
                continue
            blob = _resolve(objects, v["EncryptedData"])
            if not isinstance(blob, bytes) or not blob:
                continue
            parsed = _parse_proto_strings(blob)
            if k == "name" and parsed:
                result["name"] = parsed[0]
            elif k in ("symbols", "watchlistIDs") and parsed:
                result["symbols"] = parsed

    return result


# ── Data loading ───────────────────────────────────────────────────────────────

def load_watchlists() -> tuple[list[dict], list[str]]:
    """
    Load all watchlists from the CloudKit dbstore.
    Returns (watchlists, order) where order is the list of record UUIDs from
    the WatchlistOrder record.
    """
    dbstore_path = next((p for p in DBSTORE_CANDIDATES if p.exists()), None)
    if dbstore_path is None:
        raise SystemExit(
            "ERROR: Cannot read the Stocks CloudKit store.\n"
            f"  Expected at: {DBSTORE_CANDIDATES[0]}\n"
            "  Make sure Terminal has Full Disk Access "
            "(System Settings → Privacy & Security → Full Disk Access)."
        )

    with dbstore_path.open() as f:
        data = json.load(f)

    watchlists: list[dict] = []
    order: list[str] = []

    for zone in data.get("database", {}).get("zones", []):
        if zone.get("name") != "Watchlist":
            continue
        for rec_b64 in zone.get("serverRecords", []):
            rec = _parse_ck_record(rec_b64)
            if rec["record_type"] == "WatchlistOrder":
                order = rec["symbols"]
            elif rec["record_type"] == "Watchlist":
                if not rec["name"] and not rec["symbols"]:
                    continue  # tombstone of a deleted watchlist
                watchlists.append(rec)

    return watchlists, order


def load_stock_metadata() -> dict[str, dict]:
    """Load stock metadata (name, exchange, price, …) from cached quote responses."""
    metadata: dict[str, dict] = {}
    if not FS_CACHE_DIR.exists():
        return metadata

    for f in FS_CACHE_DIR.iterdir():
        try:
            data = json.loads(f.read_bytes())
        except Exception:
            continue
        for q in data.get("quotes", []):
            sym = q.get("symbol")
            if not sym:
                continue
            detail = q.get("quoteDetail", {}) or {}
            if sym not in metadata or detail.get("price") is not None:
                metadata[sym] = {
                    "name": q.get("name") or sym,
                    "compactName": q.get("compactName") or q.get("shortName") or "",
                    "exchange": q.get("exchange") or "",
                    "symbolType": q.get("symbolType") or "",
                    "currency": detail.get("currency") or "",
                    "price": detail.get("price"),
                    "marketCap": detail.get("marketCapitalization"),
                }
    return metadata


def get_active_watchlist_id() -> str:
    try:
        with MAIN_PLIST.open("rb") as f:
            prefs = plistlib.load(f)
        return prefs.get("active_watchlist", "watchlist")
    except Exception:
        return "watchlist"


def _load_env_file(path: Path) -> dict[str, str]:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


# ── Export building ────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    """Turn a watchlist name into a stable, filesystem-safe filename."""
    slug = name.strip().lower()
    slug = re.sub(r"[/\\:*?\"<>|]", "-", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "watchlist"


def build_export() -> dict:
    watchlists, order = load_watchlists()
    stock_meta = load_stock_metadata()
    active_id = get_active_watchlist_id()

    # Order like the app's dropdown; unknown IDs go last, sorted by name
    order_index = {rid: i for i, rid in enumerate(order)}
    watchlists.sort(
        key=lambda w: (order_index.get(w["record_id"], len(order)), w["name"] or "")
    )

    out_watchlists = []
    for wl in watchlists:
        stocks = []
        for sym in wl["symbols"]:
            meta = stock_meta.get(sym, {})
            stocks.append(
                {
                    "symbol": sym,
                    "name": meta.get("name") or sym,
                    "compactName": meta.get("compactName") or "",
                    "exchange": meta.get("exchange") or "",
                    "symbolType": meta.get("symbolType") or "",
                    "currency": meta.get("currency") or "",
                    "lastPrice": meta.get("price"),
                    "marketCap": meta.get("marketCap"),
                }
            )
        out_watchlists.append(
            {
                "name": wl["name"] or wl["record_id"],
                "slug": slugify(wl["name"] or wl["record_id"]),
                "id": wl["record_id"],
                "is_active": wl["record_id"] == active_id,
                "created": wl["created"],
                "modified": wl["modified"],
                "modified_by_device": wl["device"],
                "symbol_count": len(stocks),
                "stocks": stocks,
            }
        )

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source": "CloudKit private database mirror (group.com.apple.stocks)",
        "watchlist_count": len(out_watchlists),
        "watchlists": out_watchlists,
    }


# ── Output formatters ──────────────────────────────────────────────────────────

def watchlist_to_csv(wl: dict) -> str:
    lines = ["symbol,name,compact_name,exchange,symbol_type,currency,last_price,market_cap"]
    for s in wl["stocks"]:
        price = s["lastPrice"] if s["lastPrice"] is not None else ""
        mcap = s["marketCap"] if s["marketCap"] is not None else ""
        name = s["name"].replace(",", " ")
        compact = s["compactName"].replace(",", " ")
        lines.append(
            f'{s["symbol"]},{name},{compact},{s["exchange"]},'
            f'{s["symbolType"]},{s["currency"]},{price},{mcap}'
        )
    return "\n".join(lines)


def watchlist_to_markdown(wl: dict) -> str:
    active = " (active)" if wl["is_active"] else ""
    lines = [
        f"# {wl['name']}{active}",
        "",
        f"**Stocks:** {wl['symbol_count']}  ",
        f"**Last modified:** {wl['modified'] or 'unknown'} by {wl['modified_by_device'] or 'unknown'}",
        "",
        "| Symbol | Name | Exchange | Type | Last Price |",
        "|--------|------|----------|------|------------|",
    ]
    for s in wl["stocks"]:
        price = f"{s['lastPrice']:.2f}" if s["lastPrice"] is not None else "—"
        name = (s["compactName"] or s["name"])[:45]
        lines.append(
            f"| `{s['symbol']}` | {name} | {s['exchange']} | {s['symbolType']} | {price} |"
        )
    lines.append("")
    return "\n".join(lines)


def build_readme(export: dict) -> str:
    lines = [
        "# Stocks Watchlists Export",
        "",
        f"**Exported:** {export['exported_at']}  ",
        f"**Source:** {export['source']}",
        "",
        "| Watchlist | Stocks | Active | Last Modified | File |",
        "|-----------|--------|--------|---------------|------|",
    ]
    for wl in export["watchlists"]:
        active = "✓" if wl["is_active"] else ""
        modified = (wl["modified"] or "")[:10]
        lines.append(
            f"| {wl['name']} | {wl['symbol_count']} | {active} | {modified} | `{wl['slug']}` |"
        )
    lines.append("")
    return "\n".join(lines)


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Export watchlists from the macOS/iOS Stocks app"
    )
    parser.add_argument(
        "--format",
        choices=["json", "csv", "markdown", "all"],
        default="all",
        help="Per-watchlist file format(s) to write (default: all)",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory in which to create the watchlists/ folder (default: current dir)",
    )
    args = parser.parse_args()

    print("Reading Stocks app data...", flush=True)
    export = build_export()

    out_dir = Path(args.output_dir) / "watchlists"
    out_dir.mkdir(parents=True, exist_ok=True)

    formats = ["json", "csv", "markdown"] if args.format == "all" else [args.format]

    for wl in export["watchlists"]:
        base = out_dir / wl["slug"]
        if "json" in formats:
            base.with_suffix(".json").write_text(
                json.dumps(wl, indent=2, ensure_ascii=False), encoding="utf-8"
            )
        if "csv" in formats:
            base.with_suffix(".csv").write_text(watchlist_to_csv(wl), encoding="utf-8")
        if "markdown" in formats:
            base.with_suffix(".md").write_text(watchlist_to_markdown(wl), encoding="utf-8")

    # Index (without full stock lists) + README
    index = {
        "exported_at": export["exported_at"],
        "source": export["source"],
        "watchlist_count": export["watchlist_count"],
        "watchlists": [
            {k: wl[k] for k in ("name", "slug", "id", "is_active", "created", "modified", "modified_by_device", "symbol_count")}
            for wl in export["watchlists"]
        ],
    }
    (out_dir / "index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (out_dir / "README.md").write_text(build_readme(export), encoding="utf-8")

    print(f"\nExported {export['watchlist_count']} watchlists to {out_dir}/")
    for wl in export["watchlists"]:
        active = " (active)" if wl["is_active"] else ""
        print(f"  {wl['name']}{active}: {wl['symbol_count']} symbols → {wl['slug']}.*")


if __name__ == "__main__":
    main()
