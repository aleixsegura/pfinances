import type { PositionsSummary, RevolutCash, RevolutFile } from "./types";

export interface CashSource {
  /** "degiro" | "revolut" | "boosted" — the caller maps to a label. */
  key: "degiro" | "revolut" | "boosted";
  /** Native currency of the source (for the DEGIRO foreign-currency rows). */
  currency: string;
  amount: number;
  amountEur: number;
}

export interface PortfolioTotals {
  /** DEGIRO positions + Revolut crypto, EUR. */
  portfolioValue: number;
  /** DEGIRO cash (all currencies) + Revolut current + Boosted, EUR. */
  cash: number;
  cashSources: CashSource[];
  hasCash: boolean;
  /** portfolioValue + cash — the "Total value" KPI. */
  totalValue: number;
  /** Open-positions P/L (DEGIRO lifetime + Revolut cost-basis P/L). */
  openPl: number;
  openPct: number | null;
  hasRevolutPl: boolean;
  todayPl: number;
  todayPct: number | null;
  hasRevolutToday: boolean;
}

export interface RevolutInputs {
  cash?: RevolutCash[];
  valueEur?: number;
  plEur?: number;
  costEur?: number;
  todayPlEur?: number;
}

/** The arithmetic behind the Holdings KPIs, shared with the Dashboard so both
 * show the same net worth, today's move and open P/L. */
export function portfolioTotals(summary: PositionsSummary, revolut: RevolutInputs): PortfolioTotals {
  const portfolioValue = summary.totalValueEur + (revolut.valueEur ?? 0);

  const degiroCashEur = summary.cashEur ?? 0;
  const revolutCurrentEur = (revolut.cash ?? [])
    .filter((c) => c.kind === "current")
    .reduce((sum, c) => sum + c.amountEur, 0);
  const revolutSavingsEur = (revolut.cash ?? [])
    .filter((c) => c.kind === "savings")
    .reduce((sum, c) => sum + c.amountEur, 0);
  // One row per DEGIRO currency; older exports have no breakdown.
  const degiroSources: CashSource[] = summary.cashBreakdown?.length
    ? summary.cashBreakdown.map((c) => ({
        key: "degiro" as const,
        currency: c.currency,
        amount: c.amount,
        amountEur: c.amountEur,
      }))
    : [{ key: "degiro" as const, currency: "EUR", amount: degiroCashEur, amountEur: degiroCashEur }];
  const allSources: CashSource[] = [
    ...degiroSources,
    { key: "revolut", currency: "EUR", amount: revolutCurrentEur, amountEur: revolutCurrentEur },
    { key: "boosted", currency: "EUR", amount: revolutSavingsEur, amountEur: revolutSavingsEur },
  ];
  const cashSources = allSources.filter((s) => s.amountEur > 0);
  const cash = degiroCashEur + revolutCurrentEur + revolutSavingsEur;
  const hasCash = summary.cashEur !== null || revolut.cash !== undefined;

  // Open positions P/L: DEGIRO's plBase folds realized P&L and fees into a
  // position's lifetime figure, so this is "all-time return". When a Revolut
  // crypto cost basis exists, its unrealized P&L is added.
  const hasRevolutPl = revolut.plEur !== undefined;
  const openPl = summary.totalPlEur + (revolut.plEur ?? 0);
  const openCost = summary.totalValueEur - summary.totalPlEur + (revolut.costEur ?? 0);
  const openPct = openCost > 0 ? (openPl / openCost) * 100 : null;

  // Today: DEGIRO plus Revolut crypto (when the export provides it). The %
  // base is both portfolios' previous-close value.
  const hasRevolutToday = revolut.todayPlEur !== undefined;
  const todayPl = summary.totalTodayPlEur + (revolut.todayPlEur ?? 0);
  const prevClose =
    summary.totalValueEur - summary.totalTodayPlEur + (revolut.valueEur ?? 0) - (revolut.todayPlEur ?? 0);
  const todayPct = prevClose > 0 ? (todayPl / prevClose) * 100 : null;

  return {
    portfolioValue,
    cash,
    cashSources,
    hasCash,
    totalValue: portfolioValue + cash,
    openPl,
    openPct,
    hasRevolutPl,
    todayPl,
    todayPct,
    hasRevolutToday,
  };
}

/** Revolut inputs for `portfolioTotals` straight from revolut.json. */
export function revolutInputs(revolut: RevolutFile | null): RevolutInputs {
  if (!revolut) return {};
  const valueEur = revolut.positions.reduce((sum, p) => sum + (p.valueEur ?? 0), 0);
  const costed = revolut.positions.filter((p) => p.plEur != null && p.costEur != null);
  return {
    cash: revolut.cash,
    valueEur,
    plEur: costed.length ? costed.reduce((s, p) => s + (p.plEur ?? 0), 0) : undefined,
    costEur: costed.length ? costed.reduce((s, p) => s + (p.costEur ?? 0), 0) : undefined,
    todayPlEur: revolut.totalTodayPlEur,
  };
}
