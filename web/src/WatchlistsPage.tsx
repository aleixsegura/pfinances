import { Link } from "react-router-dom";
import { useAppData } from "./data";
import { useTranslation } from "./i18n/LanguageContext";

export default function WatchlistsPage() {
  const { watchlists } = useAppData();
  const { t } = useTranslation();
  const lists = watchlists.filter((w) => w.slug !== "holdings");

  if (lists.length === 0) return null;

  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">{t.watchlists.title}</h2>
      <ul className="m-0 max-w-md list-none divide-y divide-hairline overflow-hidden card p-0">
        {lists.map((w) => (
          <li key={w.slug}>
            <Link
              to={`/watchlists/${w.slug}`}
              className="flex items-baseline gap-2.5 px-4 py-3 no-underline hover:bg-hover"
            >
              <span className="font-semibold text-primary">{w.name}</span>
              <span className="ml-auto text-sm tabular-nums text-muted">{w.symbol_count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
