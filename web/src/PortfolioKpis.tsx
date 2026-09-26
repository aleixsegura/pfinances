import type { PositionsSummary, RevolutCash } from "./types";
import KpiCard, { SUB, type BreakdownRow } from "./KpiCard";
import { useTranslation } from "./i18n/LanguageContext";
import { eur, eurSigned, gainLoss, pctSigned } from "./format";
import { portfolioTotals, type CashSource } from "./portfolioMath";

/** taxes.json's platform string for Revolut, the one platform that also has a
 * live position feed to fold into its row. */
const REVOLUT = "Revolut";

interface Props {
  summary: PositionsSummary;
  /** Revolut cash accounts (current + savings), per-account; absent when revolut.json is missing. */
  revolutCash?: RevolutCash[];
  /** Revolut non-cash holdings (crypto) in EUR. */
  revolutValueEur?: number;
  /** Revolut crypto open-positions P/L (EUR); undefined when no cost basis is configured. */
  revolutPlEur?: number;
  /** EUR cost basis behind revolutPlEur, for the combined P/L %. */
  revolutCostEur?: number;
  /** Revolut crypto today P/L (EUR); undefined when revolut.json is missing
   * or predates the totalTodayPlEur field. */
  revolutTodayPlEur?: number;
  /** Gains already realised outside DEGIRO, per platform (see
   * `externalRealizedByPlatform`); empty when taxes.json has none. */
  externalRealizedByPlatform?: Map<string, number>;
}

export default function PortfolioKpis({
  summary,
  revolutCash,
  revolutValueEur,
  revolutPlEur,
  revolutCostEur,
  revolutTodayPlEur,
  externalRealizedByPlatform,
}: Props) {
  const { t } = useTranslation();
  const totals = portfolioTotals(summary, {
    cash: revolutCash,
    valueEur: revolutValueEur,
    plEur: revolutPlEur,
    costEur: revolutCostEur,
    todayPlEur: revolutTodayPlEur,
  });
  const { portfolioValue, cash, cashSources, hasCash, totalValue, openPl, openPct, hasRevolutPl, todayPl, todayPct, hasRevolutToday } = totals;
  // Foreign-currency DEGIRO rows carry the native amount in the label
  // ("DEGIRO · 756,08 US$") with the EUR countervalue as value.
  const sourceLabel = (s: CashSource) =>
    s.key === "revolut"
      ? t.kpis.revolut
      : s.key === "boosted"
        ? t.kpis.boosted
        : s.currency === "EUR"
          ? t.kpis.degiro
          : `${t.kpis.degiro} · ${new Intl.NumberFormat("es-ES", { style: "currency", currency: s.currency }).format(s.amount)}`;

  // Total P/L: DEGIRO's account-level figure (realized + unrealized + fees +
  // dividends), and the same all-in view of every other platform — its open
  // P/L plus whatever it has already realized. That realized half is what
  // taxes.json's FIFO ledger contributes: a closed Revolut position leaves no
  // trace in any snapshot, so without it selling at a profit silently shrinks
  // this KPI.
  const accountPl = summary.accountPlEur ?? 0;
  const platformPl = new Map<string, number>(externalRealizedByPlatform ?? []);
  if (hasRevolutPl) platformPl.set(REVOLUT, (platformPl.get(REVOLUT) ?? 0) + revolutPlEur!);
  const totalPl = accountPl + [...platformPl.values()].reduce((sum, v) => sum + v, 0);
  const totalPlRows: BreakdownRow[] = [
    { label: t.kpis.degiro, value: eurSigned.format(accountPl), valueClass: gainLoss(accountPl) },
    ...[...platformPl].map(([platform, pl]) => ({
      label: platform === REVOLUT ? t.kpis.revolut : platform,
      value: eurSigned.format(pl),
      valueClass: gainLoss(pl),
    })),
  ];

  return (
    <section
      className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]"
      aria-label={t.kpis.ariaLabel}
    >
      <KpiCard
        label={t.kpis.totalValue}
        value={eur.format(totalValue)}
        sub={<span className={`${SUB} text-secondary`}>{t.kpis.positionsPlusCash}</span>}
      />

      <KpiCard
        label={t.kpis.portfolioValue}
        value={eur.format(portfolioValue)}
        sub={<span className={`${SUB} text-secondary`}>{t.kpis.exclCash}</span>}
      />

      {hasCash && (
        <KpiCard
          label={t.kpis.totalCash}
          value={eur.format(cash)}
          ariaLabel={t.kpis.totalCashAria(eur.format(cash), cashSources.length)}
          sub={
            cashSources.length > 1 ? (
              <span className={`${SUB} text-secondary`}>
                {t.kpis.acrossAccounts(cashSources.length)}
              </span>
            ) : undefined
          }
          breakdown={
            cashSources.length > 1
              ? cashSources.map((s) => ({ label: sourceLabel(s), value: eur.format(s.amountEur) }))
              : undefined
          }
        />
      )}

      <KpiCard
        label={t.kpis.openPositionsPl}
        value={eurSigned.format(openPl)}
        valueClass={gainLoss(openPl)}
        ariaLabel={
          hasRevolutPl
            ? t.kpis.openPositionsPlAria(
                eurSigned.format(openPl),
                eurSigned.format(summary.totalPlEur),
                eurSigned.format(revolutPlEur!),
              )
            : undefined
        }
        sub={
          openPct !== null ? (
            <span className={`${SUB} ${gainLoss(openPl)}`}>{pctSigned.format(openPct)}%</span>
          ) : undefined
        }
        breakdown={
          hasRevolutPl
            ? [
                {
                  label: t.kpis.degiro,
                  value: eurSigned.format(summary.totalPlEur),
                  valueClass: gainLoss(summary.totalPlEur),
                },
                {
                  label: t.kpis.revolut,
                  value: eurSigned.format(revolutPlEur!),
                  valueClass: gainLoss(revolutPlEur!),
                },
              ]
            : undefined
        }
      />

      {summary.accountPlEur != null && (
        <KpiCard
          label={t.kpis.totalPl}
          value={eurSigned.format(totalPl)}
          valueClass={gainLoss(totalPl)}
          ariaLabel={
            totalPlRows.length > 1
              ? t.kpis.totalPlAria(
                  eurSigned.format(totalPl),
                  totalPlRows.map((r) => `${r.label} ${r.value}`).join(", "),
                )
              : undefined
          }
          sub={
            <span className={`${SUB} text-secondary`}>{t.kpis.inclRealizedFeesDividends}</span>
          }
          breakdown={totalPlRows.length > 1 ? totalPlRows : undefined}
        />
      )}

      <KpiCard
        label={t.kpis.today}
        value={eurSigned.format(todayPl)}
        valueClass={gainLoss(todayPl)}
        ariaLabel={
          hasRevolutToday
            ? t.kpis.todayAria(
                eurSigned.format(todayPl),
                eurSigned.format(summary.totalTodayPlEur),
                eurSigned.format(revolutTodayPlEur!),
              )
            : undefined
        }
        sub={
          todayPct !== null ? (
            <span className={`${SUB} ${gainLoss(todayPl)}`}>
              {pctSigned.format(todayPct)}%
            </span>
          ) : undefined
        }
        breakdown={
          hasRevolutToday
            ? [
                {
                  label: t.kpis.degiro,
                  value: eurSigned.format(summary.totalTodayPlEur),
                  valueClass: gainLoss(summary.totalTodayPlEur),
                },
                {
                  label: t.kpis.revolut,
                  value: eurSigned.format(revolutTodayPlEur!),
                  valueClass: gainLoss(revolutTodayPlEur!),
                },
              ]
            : undefined
        }
      />
    </section>
  );
}
