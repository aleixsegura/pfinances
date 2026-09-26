#!/usr/bin/env python3
"""Fails if a commit would publish personal financial data.

Two checks:

1. Paths. Nothing under watchlists/ (real exports), no .env, no *.local.*
   file, no broker/crypto side files may be tracked. Runs anywhere, CI included.
2. Content. When the real exports exist (i.e. on the owner's machine), every
   symbol and asset name found in them is searched for in the tracked files.
   The list is built on the fly from the gitignored data, so the check itself
   never names a holding. Symbols the synthetic demo-data/ also uses (BTC,
   AAPL, …) are fair game: the demo already shows them publicly.

    python scripts/privacy_check.py            # tracked + staged files
    git config core.hooksPath .githooks        # run it before every commit
"""
import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "watchlists"
DEMO = ROOT / "demo-data"

FORBIDDEN_PATHS = [
    "watchlists/*",
    ".env",
    "*.local.*",
    "crypto_cost_basis.json",
    "manual_trades.json",
    "bybit.csv",
    ".revolut-profile/*",
    ".revolut-debug/*",
]
# Too generic to mean anything on their own.
IGNORED_TERMS = {"EUR", "USD", "EURUSD=X", "Cash"}
MIN_TERM_LENGTH = 3


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "--cached"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [line for line in out.splitlines() if line]


def collect_terms(node, terms: set[str]) -> None:
    """Every symbol in an export, at any depth, plus the names that travel
    with one (a watchlist's or an account's own name is not a holding)."""
    if isinstance(node, dict):
        if isinstance(node.get("symbol"), str):
            for key in ("symbol", "name", "compactName"):
                if isinstance(node.get(key), str):
                    terms.add(node[key].strip())
        for value in node.values():
            collect_terms(value, terms)
    elif isinstance(node, list):
        for value in node:
            collect_terms(value, terms)


def real_terms() -> set[str]:
    terms: set[str] = set()
    for path in DATA.glob("*.json"):
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        collect_terms(data, terms)
        if path.name == "symbols.json":
            terms.update(data.get("sectors", {}))
            terms.update(data.get("degiroAliases", {}).values())
    public = "\n".join(p.read_text() for p in DEMO.glob("*.json")) if DEMO.is_dir() else ""
    return {
        t
        for t in terms
        if len(t) >= MIN_TERM_LENGTH
        and t not in IGNORED_TERMS
        and not re.search(rf"(?<![\w.-]){re.escape(t)}(?![\w-])", public)
    }


def main() -> int:
    files = tracked_files()
    problems = [
        f"tracked private file: {f}"
        for f in files
        if any(fnmatch.fnmatch(f, pattern) for pattern in FORBIDDEN_PATHS)
    ]

    if DATA.is_dir():
        terms = real_terms()
        if terms:
            pattern = re.compile(
                r"(?<![\w.-])(" + "|".join(sorted(map(re.escape, terms), key=len, reverse=True)) + r")(?![\w-])"
            )
            for f in files:
                if f.startswith("demo-data/") or f.endswith("package-lock.json"):
                    continue
                try:
                    text = (ROOT / f).read_text()
                except (OSError, UnicodeDecodeError):
                    continue
                for n, line in enumerate(text.splitlines(), 1):
                    if pattern.search(line):
                        # Name the file and line, never the term: this output
                        # can end up in a shared terminal or CI log.
                        problems.append(f"{f}:{n}: mentions one of your real holdings")

    for problem in problems:
        print(f"privacy_check: {problem}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
