import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "./i18n/LanguageContext";
import type {
  DividendsFile,
  HistoryFile,
  MarketCapsFile,
  PositionsFile,
  RevolutFile,
  RevolutTransactionsFile,
  TaxesFile,
  WatchlistDetail,
} from "./types";

interface AppData {
  positions: PositionsFile | null;
  revolut: RevolutFile | null;
  history: HistoryFile | null;
  dividends: DividendsFile | null;
  taxes: TaxesFile | null;
  marketCaps: MarketCapsFile | null;
  transactions: RevolutTransactionsFile | null;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<PositionsFile | null>(null);
  const [revolut, setRevolut] = useState<RevolutFile | null>(null);
  const [history, setHistory] = useState<HistoryFile | null>(null);
  const [dividends, setDividends] = useState<DividendsFile | null>(null);
  const [taxes, setTaxes] = useState<TaxesFile | null>(null);
  const [marketCaps, setMarketCaps] = useState<MarketCapsFile | null>(null);
  const [transactions, setTransactions] = useState<RevolutTransactionsFile | null>(null);

  useEffect(() => {
    // Written by export_degiro.py; degrade silently when it doesn't exist.
    // Vite's dev server SPA-fallbacks unknown paths to index.html with a 200,
    // so the content-type check is what actually detects a missing file.
    fetch("/positions.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: PositionsFile | null) => setPositions(data))
      .catch(() => setPositions(null));
  }, []);

  useEffect(() => {
    // Written by export_revolut.py; same silent degrade as positions.json.
    fetch("/revolut.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: RevolutFile | null) => setRevolut(data))
      .catch(() => setRevolut(null));
  }, []);

  useEffect(() => {
    // Written by history.py (called from the broker exporters); same silent
    // degrade — the chart shows a placeholder until snapshots exist.
    fetch("/history.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: HistoryFile | null) => setHistory(data))
      .catch(() => setHistory(null));
  }, []);

  useEffect(() => {
    // Written by export_dividends.py; same silent degrade as positions.json.
    fetch("/dividends.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: DividendsFile | null) => setDividends(data))
      .catch(() => setDividends(null));
  }, []);

  useEffect(() => {
    // Written by export_taxes.py; same silent degrade as positions.json.
    fetch("/taxes.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: TaxesFile | null) => setTaxes(data))
      .catch(() => setTaxes(null));
  }, []);

  useEffect(() => {
    // Written by export_marketcaps.py; same silent degrade as positions.json —
    // without it the table falls back to the watchlist's cached market caps.
    fetch("/marketcaps.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: MarketCapsFile | null) => setMarketCaps(data))
      .catch(() => setMarketCaps(null));
  }, []);

  useEffect(() => {
    // Written by export_revolut.py (write_transactions); same silent degrade —
    // the Dashboard and Transactions pages show empty states until it exists.
    fetch("/revolut_transactions.json")
      .then((res) => {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        return res.ok && isJson ? res.json() : null;
      })
      .then((data: RevolutTransactionsFile | null) => setTransactions(data))
      .catch(() => setTransactions(null));
  }, []);

  return (
    <AppDataContext.Provider
      value={{
        positions,
        revolut,
        history,
        dividends,
        taxes,
        marketCaps,
        transactions,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (!data) throw new Error("useAppData must be used inside <AppDataProvider>");
  return data;
}

/** Look a symbol's market cap up in marketcaps.json (export_marketcaps.py).
 *
 * Preferred over the watchlist's own `marketCap` because that one is whatever
 * the Apple Stocks app last cached — missing entirely for anything not in a
 * watchlist, and only refreshed when export_watchlists.py runs. Entries are
 * written under every symbol spelling, so an exact hit is the normal case; the
 * bare-ticker retry only covers a position exported after the last market-cap
 * run ("VWCE" for the watchlist's "VWCE.DE").
 */
export function useMarketCap(): (symbol: string) => number | null {
  const { marketCaps } = useAppData();
  return useCallback(
    (symbol: string) => {
      const entries = marketCaps?.entries;
      if (!entries) return null;
      const entry = entries[symbol] ?? entries[symbol.split(".")[0]];
      return entry?.marketCap ?? null;
    },
    [marketCaps],
  );
}

export function useWatchlistDetail(slug: string) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<WatchlistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setDetail(null);
    setLoading(true);
    setError(null);
    fetch(`/${slug}.json`)
      .then((res) => {
        // Same content-type check as above: an unknown slug SPA-fallbacks to
        // index.html with a 200, which would otherwise surface as a SyntaxError.
        const isJson = res.headers.get("content-type")?.includes("application/json");
        if (!res.ok || !isJson) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: WatchlistDetail) => setDetail(data))
      .catch((err) => setError(t.errors.watchlist(slug, err.message)))
      .finally(() => setLoading(false));
  }, [slug, t]);

  return { detail, error, loading };
}
