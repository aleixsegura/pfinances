import type { TaxesFile } from "./types";

const DEGIRO = "DEGIRO";

/** Platforms that only ever *acquired* coins, mapped to the platform that
 * actually custodies them. Bybit is a buying venue whose coins were moved to
 * the Revolut wallet, so a reward it booked is Revolut's line in the P/L
 * breakdown — the same attribution the capital-gains rows already use. */
const CUSTODIAN: Record<string, string> = { Bybit: "Revolut" };

/** Realised P&L booked *outside* DEGIRO, totalled per platform across every
 * fiscal year in taxes.json. Empty when taxes.json is missing or holds
 * nothing but DEGIRO rows, so the KPIs fall back to the broker-only figures.
 *
 * Why it has to come from here: a Revolut sale leaves no trace in any
 * snapshot. The position vanishes from revolut.json and the proceeds turn
 * into plain cash, so the profit is invisible to both the open-positions P/L
 * and the Revolut cost-basis file. Only the FIFO ledger in taxes.json still
 * knows it happened.
 *
 * DEGIRO rows are filtered out because `summary.accountPlEur` (netliq − net
 * deposits) already carries its realised gains, fees and dividends — and
 * taxes.json rebuilds those same sales from the transaction history, so
 * adding them would count every DEGIRO exit twice.
 *
 * Keyed by the platform that booked the *disposal*, which is what the money
 * followed: coins bought on Bybit and sold on Revolut belong to Revolut here,
 * the way `aggregate_asset_year` already attributes them. Acquisition-only
 * venues are folded into their custodian by `CUSTODIAN`, so a Bybit staking
 * reward lands on the Revolut row instead of opening a third one for a few
 * euros.
 *
 * `resultEur` rather than `computableResultEur`: the two-month rule only
 * defers a loss for *tax* purposes, and this is a portfolio figure.
 *
 * Staking rewards count at the EUR value they were credited at — coins that
 * arrive for free are profit the moment they land. They do overlap with the
 * hand-written average in crypto_cost_basis.json when rewarded coins are
 * still held (a blended average silently treats them as bought); with the ETH
 * position fully closed there is nothing to double-count today. */
export function externalRealizedByPlatform(taxes: TaxesFile | null): Map<string, number> {
  const byPlatform = new Map<string, number>();
  if (!taxes) return byPlatform;
  const add = (platform: string, amount: number) => {
    if (platform === DEGIRO) return;
    const key = CUSTODIAN[platform] ?? platform;
    byPlatform.set(key, (byPlatform.get(key) ?? 0) + amount);
  };
  for (const year of taxes.years) {
    for (const asset of year.capitalGains.byAsset) add(asset.platform, asset.resultEur);
    for (const reward of year.investmentIncome.staking.rewards)
      add(reward.platform, reward.valueEur);
  }
  for (const [platform, total] of byPlatform)
    byPlatform.set(platform, Math.round(total * 100) / 100);
  return byPlatform;
}
