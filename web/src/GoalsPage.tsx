import { useEffect, useMemo, useState } from "react";
import { useAppData } from "./data";
import KpiCard, { SUB } from "./KpiCard";
import IndicatorChart, { type ChartSeries, type Threshold } from "./IndicatorChart";
import GoalProgressBar from "./GoalProgressBar";
import { AJD_PCT, DOWN_PAYMENT_PCT, IVA_PCT, currentCapital, goalBreakdown, projectAll } from "./goalMath";
import { useGoalSettings, type GoalSettings } from "./useGoalSettings";
import { useTranslation } from "./i18n/LanguageContext";
import type { Translations } from "./i18n/en";

const eur0 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** "2028-03-01" → "Mar 2028". */
function fmtMonth(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function fmtReturn(annualReturn: number): string {
  return `${(annualReturn * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })} %`;
}

/** Whole months from `from` to `to` (both "YYYY-MM-DD"), for the "in 1 y 8 mo" subs. */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  return (ty - fy) * 12 + (tm - fm);
}

function fmtMonthsAway(t: Translations, months: number): string {
  if (months <= 0) return t.goals.now;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return t.goals.inMonths(m);
  if (m === 0) return t.goals.inYears(y);
  return t.goals.inYearsMonths(y, m);
}

/** Trailing debounce, so dragging a slider doesn't rebuild the chart on every
 * step — only the KPIs and the bar track the live value. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const FIELD_LABEL = "text-xs font-medium text-secondary";
const NUMBER_INPUT =
  "w-24 rounded-md border border-hairline bg-canvas px-2 py-1 text-right text-sm tabular-nums " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";

function RangeField({
  label,
  valueText,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className={FIELD_LABEL}>{label}</span>
        <span className="text-xs font-semibold tabular-nums">{valueText}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sector-1"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  placeholder,
  suffix = "€",
}: {
  label: string;
  /** null renders empty (used by the return override). */
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <label className="flex items-baseline justify-between gap-3">
      <span className={FIELD_LABEL}>{label}</span>
      <span className="flex items-baseline gap-1.5">
        <input
          type="number"
          min={0}
          step={step}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={NUMBER_INPUT}
        />
        <span className="text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );
}

function AssumptionsPanel({
  settings,
  update,
  reset,
}: {
  settings: GoalSettings;
  update: (patch: Partial<GoalSettings>) => void;
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 self-start card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.03em] text-muted">
          {t.goals.assumptions}
        </h3>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-secondary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t.goals.reset}
        </button>
      </div>

      <RangeField
        label={t.goals.flatPrice}
        valueText={eur0.format(settings.flatPriceEur)}
        min={180000}
        max={270000}
        step={5000}
        value={settings.flatPriceEur}
        onChange={(v) => update({ flatPriceEur: v })}
      />
      <RangeField
        label={t.goals.monthlySavings}
        valueText={eur0.format(settings.monthlySavingsEur)}
        min={0}
        max={2350}
        step={50}
        value={settings.monthlySavingsEur}
        onChange={(v) => update({ monthlySavingsEur: v })}
      />
      <RangeField
        label={t.goals.shareInvested}
        valueText={`${Math.round(settings.investedPct * 100)} %`}
        min={0}
        max={100}
        step={5}
        value={Math.round(settings.investedPct * 100)}
        onChange={(v) => update({ investedPct: v / 100 })}
      />
      <NumberField
        label={t.goals.centralReturn}
        value={settings.customReturnPct === null ? null : settings.customReturnPct * 100}
        onChange={(v) => update({ customReturnPct: v === null ? null : v / 100 })}
        step={0.5}
        placeholder="5"
        suffix="%/yr"
      />
      <NumberField
        label={t.goals.fixedPurchaseCosts}
        value={settings.fixedCostsEur}
        onChange={(v) => update({ fixedCostsEur: v ?? 0 })}
        step={250}
      />
      <NumberField
        label={t.goals.emergencyReserve}
        value={settings.emergencyFundEur}
        onChange={(v) => update({ emergencyFundEur: v ?? 0 })}
        step={500}
      />
      <label className="flex items-center justify-between gap-3">
        <span className={FIELD_LABEL}>{t.goals.keepSavingAfter}</span>
        <input
          type="checkbox"
          checked={settings.contributeAfter2027}
          onChange={(e) => update({ contributeAfter2027: e.target.checked })}
          className="h-4 w-4 accent-sector-1"
        />
      </label>
    </div>
  );
}

export default function GoalsPage() {
  const { positions, revolut } = useAppData();
  const { settings, update, reset } = useGoalSettings();
  const { t } = useTranslation();

  const capital = useMemo(() => currentCapital(positions, revolut), [positions, revolut]);
  const breakdown = goalBreakdown(settings.flatPriceEur, settings.fixedCostsEur);
  const reserve = Math.min(settings.emergencyFundEur, Math.max(0, capital.cashEur));
  const available = capital.investedEur + Math.max(0, capital.cashEur - settings.emergencyFundEur);

  const startDate = useMemo(
    () => positions?.updatedAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    [positions],
  );

  // The chart tracks a debounced copy of the settings so slider drags don't
  // rebuild it on every step.
  const chartSettings = useDebounced(settings, 150);
  const projection = useMemo(
    () => projectAll({ startDate, ...capital, settings: chartSettings }),
    [startDate, capital, chartSettings],
  );

  const series: ChartSeries[] = useMemo(() => {
    const [low, mid, high] = projection.scenarios;
    // Central scenario first: the goal price-line and the last-value axis
    // label anchor to the first series.
    return [
      { label: fmtReturn(mid.annualReturn), colorVar: "--sector-1", days: mid.days },
      { label: fmtReturn(low.annualReturn), colorVar: "--sector-3", days: low.days },
      { label: fmtReturn(high.annualReturn), colorVar: "--sector-2", days: high.days },
    ];
  }, [projection]);

  const thresholds: Threshold[] = useMemo(
    () => [
      {
        price: projection.goal,
        colorVar: "--text-muted",
        dashed: true,
        title: `${t.goals.goal} · ${eur0.format(projection.goal)}`,
      },
    ],
    [projection.goal, t],
  );

  const totalExtras = settings.extraPayments.reduce((sum, e) => sum + e.amountEur, 0);

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t.goals.title}</h1>
      <p className="mb-6 text-sm text-secondary">{t.goals.description}</p>

      <section
        className="panel-grid mb-5 grid [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]"
        aria-label={t.goals.ariaLabel}
      >
        <KpiCard
          label={t.goals.goal}
          value={eur0.format(breakdown.total)}
          ariaLabel={t.goals.goalAria(eur0.format(breakdown.total))}
          sub={<span className={`${SUB} text-secondary`}>{t.goals.downPlusCosts}</span>}
          breakdown={[
            {
              label: t.goals.downPayment(DOWN_PAYMENT_PCT * 100),
              value: eur0.format(breakdown.downPayment),
            },
            { label: t.goals.iva(IVA_PCT * 100), value: eur0.format(breakdown.iva) },
            { label: t.goals.ajd(AJD_PCT * 100), value: eur0.format(breakdown.ajd) },
            { label: t.goals.notaryFixed, value: eur0.format(breakdown.fixed) },
          ]}
        />
        <KpiCard
          label={t.goals.availableToday}
          value={eur0.format(available)}
          ariaLabel={t.goals.availableTodayAria(eur0.format(available), eur0.format(reserve))}
          sub={
            <span className={`${SUB} text-secondary`}>{t.goals.exclReserve(eur0.format(reserve))}</span>
          }
          breakdown={[
            { label: t.goals.invested, value: eur0.format(capital.investedEur) },
            { label: t.goals.cash, value: eur0.format(capital.cashEur) },
            {
              label: t.goals.reserve,
              value: eur0.format(-reserve),
              valueClass: "text-muted",
            },
          ]}
        />
        {projection.scenarios.map((s) => (
          <KpiCard
            key={s.annualReturn}
            label={t.goals.atRate(fmtReturn(s.annualReturn))}
            value={s.goalDate ? fmtMonth(s.goalDate) : t.goals.moreThan15y}
            sub={
              s.goalDate ? (
                <span className={`${SUB} text-secondary`}>
                  {fmtMonthsAway(t, monthsBetween(startDate, s.goalDate))}
                </span>
              ) : undefined
            }
          />
        ))}
      </section>

      <div className="mb-8">
        <GoalProgressBar current={available} goal={breakdown.total} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">{t.goals.projection}</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <AssumptionsPanel settings={settings} update={update} reset={reset} />
          <IndicatorChart
            series={series}
            thresholds={thresholds}
            height={320}
            // The caption spells out the savings plan behind the curve, which
            // is personal; the public demo shows the chart alone.
            caption={
              import.meta.env.MODE !== "demo" &&
              (t.goals.projectionCaption(
                eur0.format(available),
                eur0.format(settings.monthlySavingsEur),
                settings.contributeAfter2027 ? t.goals.ongoing : t.goals.untilDec2027,
                Math.round(settings.investedPct * 100),
              ) +
                (totalExtras > 0 ? t.goals.plusExtra(eur0.format(totalExtras)) : "") +
                t.goals.orientativeNote)
            }
          />
        </div>
      </section>

      {positions ? (
        <UpdatedNote updatedAt={positions.updatedAt} />
      ) : (
        <p className="mt-6 text-xs text-muted">{t.goals.portfolioUnavailable}</p>
      )}
    </>
  );
}

function UpdatedNote({ updatedAt }: { updatedAt: string }) {
  const { t } = useTranslation();
  const updated = new Date(updatedAt);
  return (
    <p className="mt-6 text-xs tabular-nums text-muted">
      {t.common.updated(
        updated.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      )}
    </p>
  );
}
