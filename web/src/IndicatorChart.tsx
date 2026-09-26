import { memo, useEffect, useRef, type ReactNode } from "react";
import { ColorType, createChart, LineSeries, LineStyle } from "lightweight-charts";
import { useTranslation } from "./i18n/LanguageContext";

const CARD = "card px-6 py-5";

export interface ChartSeries {
  /** Shown in the legend; required in practice when there are 2 series. */
  label?: string;
  /** CSS custom property holding the line color, e.g. "--sector-1". */
  colorVar: string;
  days: { date: string; value: number }[];
}

export interface Threshold {
  price: number;
  colorVar: string;
  dashed?: boolean;
  title: string;
}

/** lightweight-charts paints to canvas, so CSS variables can't be passed
 * through — resolve them to literals. */
function cssVars(names: string[]): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()]));
}

/** Generic single-pane line chart: 1–2 series with a legend, labeled
 * horizontal thresholds and a caption under the plot. */
function IndicatorChart({
  series,
  thresholds = [],
  height = 340,
  caption,
}: {
  series: ChartSeries[];
  thresholds?: Threshold[];
  height?: number;
  caption?: ReactNode;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const main = series[0];

  useEffect(() => {
    const el = containerRef.current;
    if (!el || main.days.length < 2) return;

    const varNames = [
      "--text-muted",
      "--hairline",
      ...series.map((s) => s.colorVar),
      ...thresholds.map((t) => t.colorVar),
    ];
    const colors = cssVars(varNames);

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors["--text-muted"],
        fontFamily: getComputedStyle(el).fontFamily,
        // Attribution lives in the app footer instead (see the library's
        // NOTICE file) — the logo sat on top of the plot.
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: colors["--hairline"] },
        horzLines: { color: colors["--hairline"] },
      },
      rightPriceScale: { borderVisible: false },
      // Default minBarSpacing (0.5px) caps visible bars at ~2000, which
      // silently truncates decade-scale ranges to ~8 years.
      timeScale: { borderVisible: false, minBarSpacing: 0.02 },
    });

    const lineSeries = series.map((s) =>
      chart.addSeries(LineSeries, {
        color: colors[s.colorVar],
        lineWidth: 2,
        priceLineVisible: false,
        // Only the first series gets the last-value axis label; two labels
        // overlap and the second one adds nothing.
        lastValueVisible: s === main,
      }),
    );
    series.forEach((s, i) =>
      lineSeries[i].setData(s.days.map((d) => ({ time: d.date, value: d.value }))),
    );

    // Labeled thresholds — the label carries the meaning, color only echoes it.
    thresholds.forEach((t) =>
      lineSeries[0].createPriceLine({
        price: t.price,
        color: colors[t.colorVar],
        lineWidth: 1,
        lineStyle: t.dashed ? LineStyle.Dashed : LineStyle.Solid,
        title: t.title,
      }),
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, thresholds]);

  if (main.days.length < 2) {
    return (
      <figure className={`${CARD} flex min-h-[220px] items-center justify-center`}>
        <p className="max-w-[30ch] text-center text-sm text-muted">
          {t.indicatorChart.notEnoughHistory}
        </p>
      </figure>
    );
  }

  return (
    <figure className={`${CARD} flex flex-col gap-3`}>
      {series.length > 1 && (
        <ul className="m-0 flex list-none items-center gap-3 p-0">
          {series.map((s) => (
            <li key={s.colorVar} className="flex items-center gap-1.5 text-xs text-secondary">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: `var(${s.colorVar})` }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={containerRef} style={{ height }} />
      {caption && <figcaption className="text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

// The chart rebuilds its canvas whenever its props change identity, so the
// caller keeps the prop objects stable via useMemo and this stays memoized.
export default memo(IndicatorChart);
