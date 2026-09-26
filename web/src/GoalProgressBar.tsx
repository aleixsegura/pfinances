import { useTranslation } from "./i18n/LanguageContext";

const eur0 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const pct1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** Progress toward a savings goal: `current` must be the same pot the
 * projection starts from so the bar and the chart agree. */
export default function GoalProgressBar({
  current,
  goal,
}: {
  current: number;
  goal: number;
}) {
  const { t } = useTranslation();
  const pct = goal > 0 ? (current / goal) * 100 : 0;
  const width = Math.min(100, Math.max(0, pct));
  const remaining = goal - current;

  return (
    <section className="card px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.03em] text-muted">
          {t.goalProgress.savedTowardGoal}
        </span>
        <span className="text-sm font-semibold tabular-nums">{pct1.format(pct)} %</span>
      </div>
      <div
        role="progressbar"
        aria-label={t.goalProgress.savedTowardGoal}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        className="h-3 overflow-hidden rounded-full bg-elevated"
      >
        <div
          className="h-full rounded-full bg-gain transition-[width] duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-4 text-xs tabular-nums text-secondary">
        <span>{t.goalProgress.ofGoal(eur0.format(current), eur0.format(goal))}</span>
        {remaining > 0 ? (
          <span>{t.goalProgress.toGo(eur0.format(remaining))}</span>
        ) : (
          <span className="text-gain">{t.goalProgress.goalReached}</span>
        )}
      </div>
    </section>
  );
}
