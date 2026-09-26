import type { PositionsFile, RevolutFile } from "./types";
import type { GoalSettings } from "./useGoalSettings";

// Cost model for a new-build (obra nueva) flat in Catalonia bought with an
// 80%-LTV mortgage: the savings goal is the 20% down payment plus the
// purchase-side costs. Since the 2019 mortgage law the bank bears the
// loan-side notary/registry/AJD, so the buyer's fixed costs are the sale-side
// notary + registry + gestoría + tasación (configurable).
export const DOWN_PAYMENT_PCT = 0.2;
export const IVA_PCT = 0.1;
export const AJD_PCT = 0.015;

/** Salary (and thus the 1 800 €/mo savings) is only guaranteed through this
 * month; beyond it contributions depend on settings.contributeAfter2027. */
const CONTRIBUTIONS_GUARANTEED_UNTIL = "2027-12";

const MAX_MONTHS = 180;
const MIN_MONTHS = 24;
const PADDING_MONTHS = 6;

export interface GoalBreakdown {
  downPayment: number;
  iva: number;
  ajd: number;
  fixed: number;
  total: number;
}

export function goalBreakdown(priceEur: number, fixedCostsEur: number): GoalBreakdown {
  const downPayment = DOWN_PAYMENT_PCT * priceEur;
  const iva = IVA_PCT * priceEur;
  const ajd = AJD_PCT * priceEur;
  return {
    downPayment,
    iva,
    ajd,
    fixed: fixedCostsEur,
    total: downPayment + iva + ajd + fixedCostsEur,
  };
}

/** Split of today's capital, mirroring the Holdings totals: invested =
 * DEGIRO positions + Revolut crypto; cash = DEGIRO + Revolut current+savings. */
export function currentCapital(
  positions: PositionsFile | null,
  revolut: RevolutFile | null,
): { investedEur: number; cashEur: number } {
  const investedEur =
    (positions?.summary.totalValueEur ?? 0) +
    (revolut?.positions ?? []).reduce((sum, p) => sum + (p.valueEur ?? 0), 0);
  const cashEur = (positions?.summary.cashEur ?? 0) + (revolut?.totalCashEur ?? 0);
  return { investedEur, cashEur };
}

export interface ScenarioResult {
  annualReturn: number;
  /** Ascending unique dates (lightweight-charts requires both): the start
   * date, then first-of-month points. */
  days: { date: string; value: number }[];
  /** First date the projected total reaches the goal; null if never within
   * the 15-year cap. */
  goalDate: string | null;
}

export interface Projection {
  goal: number;
  /** Ascending by annualReturn: [pessimistic, central, optimistic]. */
  scenarios: ScenarioResult[];
}

/** "2026-07-21" + m months → first of that month ("2026-08-01" for m=1). */
function monthsAfter(startDate: string, m: number): string {
  const d = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
}

function projectScenario(
  startDate: string,
  investedEur: number,
  cashEur: number,
  settings: GoalSettings,
  annualReturn: number,
  goal: number,
): ScenarioResult {
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const extras = new Map(settings.extraPayments.map((e) => [e.month, e.amountEur]));

  let invested = investedEur;
  // The emergency reserve stays untouched — it never counts toward the flat.
  let cash = Math.max(0, cashEur - settings.emergencyFundEur);
  const days = [{ date: startDate, value: invested + cash }];
  let goalDate: string | null = days[0].value >= goal ? startDate : null;

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const date = monthsAfter(startDate, m);
    const month = date.slice(0, 7);
    const contributing =
      month <= CONTRIBUTIONS_GUARANTEED_UNTIL || settings.contributeAfter2027;
    const contribution = contributing ? settings.monthlySavingsEur : 0;
    // Growth compounds only on the invested share; pagas extra land as cash.
    invested = invested * (1 + monthlyRate) + contribution * settings.investedPct;
    cash += contribution * (1 - settings.investedPct) + (extras.get(month) ?? 0);
    const value = invested + cash;
    days.push({ date, value });
    if (goalDate === null && value >= goal) goalDate = date;
  }
  return { annualReturn, days, goalDate };
}

/** Runs the three scenarios (3/5/7% by default, customReturnPct replaces the
 * central one) over a shared horizon: the slowest goal crossing plus a few
 * months of padding, clamped to [2, 15] years. */
export function projectAll(input: {
  startDate: string;
  investedEur: number;
  cashEur: number;
  settings: GoalSettings;
}): Projection {
  const { startDate, investedEur, cashEur, settings } = input;
  const goal = goalBreakdown(settings.flatPriceEur, settings.fixedCostsEur).total;
  const returns = [0.03, settings.customReturnPct ?? 0.05, 0.07];

  const full = returns.map((r) =>
    projectScenario(startDate, investedEur, cashEur, settings, r, goal),
  );

  const slowestCross = Math.max(
    ...full.map((s) => {
      const i = s.days.findIndex((d) => d.value >= goal);
      return i === -1 ? MAX_MONTHS : i;
    }),
  );
  const horizon = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, slowestCross + PADDING_MONTHS));

  return {
    goal,
    scenarios: full.map((s) => ({ ...s, days: s.days.slice(0, horizon + 1) })),
  };
}
