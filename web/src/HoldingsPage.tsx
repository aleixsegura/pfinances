import { useMemo, useState } from "react";
import { useAppData } from "./data";
import { useTranslation } from "./i18n/LanguageContext";
import PortfolioChart from "./PortfolioChart";
import PortfolioKpis from "./PortfolioKpis";
import SectorDonut from "./SectorDonut";
import StocksTable from "./StocksTable";
import { sectorBreakdown, sectorVar, type Sector } from "./sectors";
import { useHoldings } from "./useHoldings";
import { shortDate } from "./format";

export default function HoldingsPage() {
  const { history } = useAppData();
  const {
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
  } = useHoldings();
  const [activeSector, setActiveSector] = useState<Sector | null>(null);
  const { t } = useTranslation();
  // Same slices the donut renders, so a highlighted row takes its slice's color.
  const sectorSlices = useMemo(
    () =>
      sectorBreakdown(
        stocks,
        showPositions ? valueBySymbol : undefined,
        showPositions && totalCashEur > 0 ? totalCashEur : undefined,
      ),
    [stocks, showPositions, valueBySymbol, totalCashEur],
  );

  if (loading) return <p className="text-secondary">{t.common.loading}</p>;
  // The watchlist is enrichment now, not the row source, so a missing or failed
  // holdings.json only costs sectors and market caps: keep rendering as long as
  // a broker export came through, and surface its error only when nothing did.
  if (stocks.length === 0) {
    if (error) return <p className="text-loss">{error}</p>;
    if (!detail) return null;
  }

  return (
    <>
      <h1 className="mb-5 font-display text-[26px] font-semibold tracking-tight">{t.nav.holdings}</h1>
      {showPositions && positions && (
        <PortfolioKpis
          summary={positions.summary}
          revolutCash={revolut ? revolut.cash : undefined}
          revolutValueEur={revolut ? revolutValueEur : undefined}
          revolutPlEur={revolutPl?.plEur}
          revolutCostEur={revolutPl?.costEur}
          revolutTodayPlEur={revolut?.totalTodayPlEur}
          externalRealizedByPlatform={externalRealized}
        />
      )}
      <div className="mb-7 flex flex-wrap items-stretch gap-x-4 gap-y-6">
        <div>
          <h2 className="mb-3 text-base font-semibold">{t.holdings.sectorDistribution}</h2>
          <SectorDonut
            stocks={stocks}
            active={activeSector}
            onActiveChange={setActiveSector}
            valueBySymbol={showPositions ? valueBySymbol : undefined}
            cashEur={showPositions && totalCashEur > 0 ? totalCashEur : undefined}
            sourceLabel={revolut ? t.holdings.sourceDegiroRevolut : t.holdings.sourceDegiro}
          />
        </div>
        <div className="flex min-w-[320px] flex-1 flex-col">
          <h2 className="mb-3 text-base font-semibold">{t.holdings.totalValue}</h2>
          <div className="flex-1">
            <PortfolioChart history={history} />
          </div>
        </div>
      </div>
      <StocksTable
        stocks={stocks}
        activeSector={activeSector}
        sectorColor={(sector) => {
          const slice = sectorSlices.find((s) => s.sector === sector);
          return sectorVar(slice ? slice.colorSlot : 0);
        }}
        positionsData={showPositions ? { posBySymbol, revolutPosBySymbol } : undefined}
      />
      {showPositions && positions && <UpdatedNote updatedAt={positions.updatedAt} />}
    </>
  );
}

function UpdatedNote({ updatedAt }: { updatedAt: string }) {
  const { t } = useTranslation();
  const updated = new Date(updatedAt);
  return (
    <p className="mt-6 text-xs tabular-nums text-muted">
      {t.common.updated(
        shortDate(updatedAt),
        updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      )}
    </p>
  );
}
