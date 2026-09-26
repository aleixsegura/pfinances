import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  createChart,
  createSeriesMarkers,
  type Time,
} from "lightweight-charts";
import { eur0, eurSigned, gainLoss, monthTick, pctSigned, shortDate } from "./format";
import { useTranslation } from "./i18n/LanguageContext";
import type { HistoryDay, HistoryFile } from "./types";

const LOCALE = { en: "en-GB", ca: "ca-ES", es: "es-ES" } as const;

const CARD = "h-full card px-6 py-5";

/** lightweight-charts paints to canvas, so CSS variables can't be passed
 * through — resolve them to literals. */
function chartColors() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    line: v("--accent"),
    text: v("--text-muted"),
    rule: v("--hairline-strong"),
    surface: v("--bg-surface"),
  };
}

/** The series is fed "YYYY-MM-DD" strings, but callbacks may hand the time
 * back as a business-day object. */
function iso(time: Time): string {
  if (typeof time === "string") return time;
  if (typeof time === "object" && "year" in time) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${time.year}-${p(time.month)}-${p(time.day)}`;
  }
  return "";
}

interface Props {
  history: HistoryFile | null;
  /** Set where the surrounding card already prints the total (the dashboard
   * hero): the caption above the plot is dropped entirely, so the chart is
   * just the line under the hero's own number. */
  quietAtRest?: boolean;
  /** Fires with the hovered snapshot (null at rest), so a surrounding hero can
   * scrub its own headline number instead of this one repeating it. */
  onHover?: (day: HistoryDay | null) => void;
}

export default function PortfolioChart({ history, quietAtRest = false, onHover }: Props) {
  const { t, lang } = useTranslation();
  const locale = LOCALE[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const days = history?.days ?? [];
  // Index of the hovered snapshot; null means "no crosshair", which reads as
  // the latest value.
  const [hovered, setHovered] = useState<number | null>(null);
  // Held in a ref: the callback identity changes on every parent render, and
  // that must not tear the chart down and rebuild it.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || days.length < 2) return;

    const colors = chartColors();
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        fontFamily: getComputedStyle(el).fontFamily,
        // Attribution lives in the app footer instead (see the library's
        // NOTICE file) — the logo sat on top of the plot.
        attributionLogo: false,
      },
      // No grid: a reference line at the first snapshot carries the levels,
      // and the value readout above the plot carries the numbers.
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false, scaleMargins: { top: 0.18, bottom: 0.08 } },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        ticksVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        // Month starts only — day-level ticks crowd an axis of manual snapshots.
        tickMarkFormatter: (time: Time, type: TickMarkType) =>
          type === TickMarkType.Month || type === TickMarkType.Year
            ? monthTick(iso(time).slice(0, 7), locale, type === TickMarkType.Year)
            : "",
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        horzLine: { visible: false, labelVisible: false },
        vertLine: { color: colors.rule, style: LineStyle.Dotted, width: 1, labelVisible: false },
      },
      // ~20 manual snapshots always fit: panning and zooming only lose them.
      handleScale: false,
      handleScroll: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: colors.line,
      lineWidth: 2,
      topColor: `${colors.line}24`,
      bottomColor: `${colors.line}00`,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerBorderColor: colors.surface,
      crosshairMarkerBackgroundColor: colors.line,
    });
    // Snapshots are sparse (exports are manual): lightweight-charts spaces
    // points by index, not calendar distance, which keeps gaps readable —
    // don't "fix" it with per-day interpolation.
    series.setData(days.map((d) => ({ time: d.date, value: d.totalEur })));

    // The one rule the grid is replaced by: where the period started.
    series.createPriceLine({
      price: days[0].totalEur,
      color: colors.rule,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: "",
    });
    // A dot on the latest point, so the resting readout has an anchor.
    const latest = days[days.length - 1];
    createSeriesMarkers(series, [
      {
        time: latest.date,
        position: "atPriceMiddle",
        price: latest.totalEur,
        shape: "circle",
        color: colors.line,
        size: 0.5,
      },
    ]);

    const indexByDate = new Map(days.map((d, i) => [d.date, i]));
    chart.subscribeCrosshairMove((param) => {
      const i = param.time ? indexByDate.get(iso(param.time)) : undefined;
      setHovered(i ?? null);
      onHoverRef.current?.(i === undefined ? null : days[i]);
    });

    chart.timeScale().fitContent();

    return () => {
      setHovered(null);
      onHoverRef.current?.(null);
      chart.remove();
    };
  }, [history, locale]);

  if (days.length === 0) {
    return (
      <figure className={`${CARD} flex items-center justify-center`}>
        <p className="max-w-[26ch] text-center text-sm text-muted">{t.portfolioChart.noHistory}</p>
      </figure>
    );
  }

  if (days.length === 1) {
    // A one-point area chart renders as an invisible dot; show the value as text.
    const only = days[0];
    return (
      <figure className={`${CARD} flex flex-col items-center justify-center gap-1`}>
        <span className="text-2xl font-semibold tabular-nums">{eur0.format(only.totalEur)}</span>
        <p className="text-sm text-muted">{t.portfolioChart.onDate(only.date)}</p>
      </figure>
    );
  }

  const first = days[0];
  const shown = days[hovered ?? days.length - 1];
  const delta = shown.totalEur - first.totalEur;
  const deltaPct = first.totalEur !== 0 ? (delta / first.totalEur) * 100 : 0;

  return (
    <figure className={`${CARD} flex flex-col`}>
      {/* The value axis, moved out of the plot: hovering the chart reads a
          snapshot here instead of in a floating label. Under a hero that
          scrubs its own headline (`quietAtRest`) there is nothing left to
          print — the value would be the same number twice — so it goes. */}
      {!quietAtRest && (
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="flex items-baseline gap-2">
            <span className="text-xl font-semibold leading-none tabular-nums">{eur0.format(shown.totalEur)}</span>
            <span className="text-xs text-muted tabular-nums">{shortDate(shown.date, locale)}</span>
          </span>
          <span className="flex items-baseline gap-1.5 text-xs tabular-nums">
            <span className={`font-medium ${gainLoss(delta)}`}>
              {eurSigned.format(delta)} ({pctSigned.format(deltaPct)}%)
            </span>
            <span className="text-muted">{t.portfolioChart.sinceStart(shortDate(first.date, locale))}</span>
          </span>
        </figcaption>
      )}
      <div ref={containerRef} className="min-h-[200px] flex-1" />
    </figure>
  );
}
