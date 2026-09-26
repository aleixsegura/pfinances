import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useMarketCap, useWatchlistDetail } from "./data";
import { useTranslation } from "./i18n/LanguageContext";
import StocksTable from "./StocksTable";

export default function WatchlistPage() {
  const { slug = "" } = useParams();
  const { detail, error, loading } = useWatchlistDetail(slug);
  const marketCapFor = useMarketCap();
  const { t } = useTranslation();

  // Same as on Holdings: marketcaps.json first, the Stocks app's cached value
  // (often missing) only as the fallback.
  const stocks = useMemo(
    () =>
      (detail?.stocks ?? []).map((s) => ({
        ...s,
        marketCap: marketCapFor(s.symbol) ?? s.marketCap,
      })),
    [detail, marketCapFor],
  );

  // Holdings is the landing page, not a watchlist route.
  if (slug === "holdings") return <Navigate to="/" replace />;

  if (loading) return <p className="text-secondary">{t.common.loading}</p>;
  if (error) return <p className="text-loss">{error}</p>;
  if (!detail) return null;

  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">{detail.name}</h2>
      <StocksTable stocks={stocks} />
    </>
  );
}
