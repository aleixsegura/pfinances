import { useMemo } from "react";
import type { Position, RevolutPosition, Stock } from "./types";
import { useAppData, useMarketCap, useWatchlistDetail } from "./data";
import { externalRealizedByPlatform } from "./realized";
import { symbolConfig } from "./symbolConfig";

const HOLDINGS_SLUG = "holdings";

// Added to the Stocks app only to check the FX rate on mobile; irrelevant here.
const EXCLUDED_HOLDINGS_SYMBOL = "EURUSD=X";

/** Match a watchlist stock to a DEGIRO position by symbol, by an alias from
 * symbols.json (same company, different exchange and ticker), or by symbol
 * prefix (Apple Stocks "VWCE.DE" vs DEGIRO "VWCE"). */
function positionFor(stock: Stock, positions: Position[]): Position | undefined {
  const alias = symbolConfig().degiroAliases[stock.symbol];
  return positions.find(
    (p) =>
      p.symbol === stock.symbol ||
      p.symbol === alias ||
      stock.symbol.split(".")[0] === p.symbol,
  );
}

/** Revolut symbols are bare ("BTC"); watchlist crypto is Yahoo-style
 * ("BTC-USD"). Restricted to crypto stocks so equities can never mis-join. */
function revolutPositionFor(
  stock: Stock,
  positions: RevolutPosition[],
): RevolutPosition | undefined {
  return positions.find(
    (p) =>
      p.symbol === stock.symbol ||
      (stock.symbolType === "CRYPTO_CURRENCY" && stock.symbol.split("-")[0] === p.symbol),
  );
}

// DEGIRO's `productType` → the watchlist `symbolType` vocabulary that TypeIcon
// and sectorFor speak. An unmapped or missing type (files from an export before
// productType was added) falls through to the generic icon rather than guessing
// "EQUITY" and mislabelling an ETF.
const SYMBOL_TYPE_BY_PRODUCT_TYPE: Record<string, string> = {
  STOCK: "EQUITY",
  ETF: "ETF",
  FUND: "MUTUAL_FUND",
};

/** Synthesize the watchlist metadata for a DEGIRO position that has no Apple
 * Stocks entry, so buying something new shows up here without touching the
 * phone. Market cap is filled in afterwards from marketcaps.json, which is
 * keyed by symbol and needs no watchlist entry. */
function stockFromPosition(p: Position): Stock {
  const productType = p.productType?.toUpperCase() ?? "";
  return {
    symbol: p.symbol,
    name: p.name || p.symbol,
    compactName: p.name || p.symbol,
    exchange: p.exchange ?? "",
    symbolType: SYMBOL_TYPE_BY_PRODUCT_TYPE[productType] ?? "",
    currency: p.currency,
    lastPrice: p.lastPrice,
    marketCap: null,
  };
}

/** Same, for a Revolut holding: everything the exporter captures is crypto. */
function stockFromRevolutPosition(p: RevolutPosition): Stock {
  return {
    symbol: p.symbol,
    name: p.name || p.symbol,
    compactName: p.name || p.symbol,
    exchange: "",
    symbolType: "CRYPTO_CURRENCY",
    currency: p.priceCurrency ?? "",
    lastPrice: p.lastPrice ?? null,
    marketCap: null,
  };
}

/** Everything "what do I hold" means, in one place: the Holdings page and the
 * Dashboard's compact view both read this so they can never disagree. */
export function useHoldings() {
  const { positions, revolut, taxes } = useAppData();
  const { detail, error, loading } = useWatchlistDetail(HOLDINGS_SLUG);
  const marketCapFor = useMarketCap();

  // What you hold comes from the brokers; the Holdings watchlist only enriches
  // it (sector, market cap, type icon, the "BTC-USD" symbol its brand icon is
  // keyed by). Rows are watchlist entries you still hold — a stock sold on
  // DEGIRO/Revolut lingers in the phone-synced watchlist and shouldn't show as
  // an empty row — followed by every position the watchlist doesn't know about,
  // synthesized from the position itself. That second half is the point: a new
  // buy appears here without being added to Apple Stocks first.
  const stocks: Stock[] = useMemo(() => {
    // marketcaps.json is the market-cap source; the watchlist's own value is
    // only the fallback for a symbol the exporter hasn't resolved yet.
    const withMarketCap = (s: Stock): Stock => ({
      ...s,
      marketCap: marketCapFor(s.symbol) ?? s.marketCap,
    });
    const watchlist = (detail?.stocks ?? []).filter((s) => s.symbol !== EXCLUDED_HOLDINGS_SYMBOL);
    // Before either broker file loads there is nothing to intersect with, so
    // show the watchlist as-is rather than flashing an empty table.
    if (!positions && !revolut) return watchlist.map(withMarketCap);

    const degiro = positions?.positions ?? [];
    const crypto = revolut?.positions ?? [];
    const matchedDegiro = new Set<string>();
    const matchedRevolut = new Set<string>();
    const held: Stock[] = [];

    for (const s of watchlist) {
      const p = positionFor(s, degiro);
      const rp = revolutPositionFor(s, crypto);
      if (p) matchedDegiro.add(p.id);
      if (rp) matchedRevolut.add(rp.symbol);
      if (p || rp) held.push(s);
    }

    return [
      ...held,
      // Exporter order (DEGIRO sorts by value, descending), appended after the
      // watchlist-backed rows so the table's leading order stays stable.
      ...degiro.filter((p) => !matchedDegiro.has(p.id)).map(stockFromPosition),
      ...crypto.filter((p) => !matchedRevolut.has(p.symbol)).map(stockFromRevolutPosition),
    ].map(withMarketCap);
  }, [detail, positions, revolut, marketCapFor]);

  const showPositions = positions !== null;

  const posBySymbol = useMemo(() => {
    const map = new Map<string, Position>();
    if (!positions) return map;
    for (const s of stocks) {
      const p = positionFor(s, positions.positions);
      if (p) map.set(s.symbol, p);
    }
    return map;
  }, [stocks, positions]);

  const revolutPosBySymbol = useMemo(() => {
    const map = new Map<string, RevolutPosition>();
    if (!revolut) return map;
    for (const s of stocks) {
      const p = revolutPositionFor(s, revolut.positions);
      if (p) map.set(s.symbol, p);
    }
    return map;
  }, [stocks, revolut]);

  const valueBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const [symbol, p] of posBySymbol) map.set(symbol, p.valueEur);
    for (const [symbol, p] of revolutPosBySymbol)
      if (p.valueEur !== null) map.set(symbol, (map.get(symbol) ?? 0) + p.valueEur);
    return map;
  }, [posBySymbol, revolutPosBySymbol]);

  const revolutValueEur = useMemo(
    () => revolut?.positions.reduce((sum, p) => sum + (p.valueEur ?? 0), 0) ?? 0,
    [revolut],
  );

  // Revolut crypto P&L, aggregated across positions that carry a manual cost
  // basis (crypto_cost_basis.json). `undefined` when none is configured, so the
  // KPIs fall back to the DEGIRO-only figures.
  const revolutPl = useMemo(() => {
    const costed = revolut?.positions.filter((p) => p.plEur != null && p.costEur != null) ?? [];
    if (costed.length === 0) return undefined;
    return {
      plEur: costed.reduce((sum, p) => sum + (p.plEur ?? 0), 0),
      costEur: costed.reduce((sum, p) => sum + (p.costEur ?? 0), 0),
    };
  }, [revolut]);

  // Profit banked outside DEGIRO (Revolut crypto sales, staking) — only the
  // FIFO ledger in taxes.json remembers it once the position is closed.
  const externalRealized = useMemo(() => externalRealizedByPlatform(taxes), [taxes]);

  const totalCashEur = (positions?.summary.cashEur ?? 0) + (revolut?.totalCashEur ?? 0);

  return {
    positions,
    revolut,
    detail,
    error,
    loading,
    stocks,
    showPositions,
    posBySymbol,
    revolutPosBySymbol,
    valueBySymbol,
    revolutValueEur,
    revolutPl,
    externalRealized,
    totalCashEur,
  };
}
