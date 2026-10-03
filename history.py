#!/usr/bin/env python3
"""
Daily portfolio-value history, appended by the broker exporters.

`record_snapshot()` reads whichever of positions.json (DEGIRO) and
revolut.json exist in the data/ directory and upserts an entry for the
current local date into data/history.json — one entry per day, so
re-running an exporter the same day just refreshes that day's numbers. When
only one exporter ran, the other source's last-known state on disk is still
folded in; its `updatedAt` records how stale it is.

The web app charts this file (served at /history.json via Vite's publicDir),
so `days` is kept sorted ascending by date with unique dates.
"""

import json
import sys
from datetime import datetime
from pathlib import Path


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, dict) else None
    except Exception as exc:
        print(f"  warning: could not read {path.name} ({exc}); skipping it.", file=sys.stderr)
        return None


def _degiro_entry(positions_file: dict | None) -> dict | None:
    if positions_file is None:
        return None
    summary = positions_file.get("summary") or {}
    cash = summary.get("cashEur")
    return {
        "updatedAt": positions_file.get("updatedAt"),
        "valueEur": round(float(summary.get("totalValueEur") or 0), 2),
        "cashEur": round(float(cash), 2) if cash is not None else None,
    }


def _revolut_entry(revolut_file: dict | None) -> dict | None:
    if revolut_file is None:
        return None
    crypto = sum(
        p["valueEur"] for p in revolut_file.get("positions", []) if p.get("valueEur") is not None
    )
    by_kind = {"current": 0.0, "savings": 0.0}
    for c in revolut_file.get("cash", []):
        kind = c.get("kind")
        if kind in by_kind and c.get("amountEur") is not None:
            by_kind[kind] += c["amountEur"]
    return {
        "updatedAt": revolut_file.get("updatedAt"),
        "cryptoValueEur": round(crypto, 2),
        "cashCurrentEur": round(by_kind["current"], 2),
        "cashSavingsEur": round(by_kind["savings"], 2),
    }


def record_snapshot(data_dir: Path) -> Path:
    """Upsert today's (local date) portfolio snapshot in history.json."""
    degiro = _degiro_entry(_read_json(data_dir / "positions.json"))
    revolut = _revolut_entry(_read_json(data_dir / "revolut.json"))

    portfolio_value = (degiro["valueEur"] if degiro else 0.0) + (
        revolut["cryptoValueEur"] if revolut else 0.0
    )
    cash = ((degiro["cashEur"] or 0.0) if degiro else 0.0) + (
        revolut["cashCurrentEur"] + revolut["cashSavingsEur"] if revolut else 0.0
    )
    day = {
        "date": datetime.now().astimezone().date().isoformat(),
        "degiro": degiro,
        "revolut": revolut,
        "portfolioValueEur": round(portfolio_value, 2),
        "cashEur": round(cash, 2),
        "totalEur": round(portfolio_value + cash, 2),
    }

    history_file = data_dir / "history.json"
    history = _read_json(history_file)
    if history is None or not isinstance(history.get("days"), list):
        if history_file.exists():
            print(f"  warning: {history_file.name} was unreadable; starting fresh.", file=sys.stderr)
        history = {"baseCurrency": "EUR", "days": []}

    history["days"] = sorted(
        [d for d in history["days"] if d.get("date") != day["date"]] + [day],
        key=lambda d: d.get("date") or "",
    )
    history_file.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n")
    return history_file
