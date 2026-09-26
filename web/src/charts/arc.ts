/** Donut geometry shared by SectorDonut and the generic Donut: each slice is
 * one stroked circle segment. dasharray draws a run of `arc − gap` (leaving a
 * surface gap between neighbours), dashoffset rotates it into position. The
 * caller rotates the SVG −90° so the first slice starts at 12 o'clock. */
export interface ArcSegment {
  dash: number;
  gap: number;
  offset: number;
}

export function donutSegments(fractions: number[], circumference: number, gapDeg: number): ArcSegment[] {
  const gapLen = (gapDeg / 360) * circumference;
  let cursor = 0;
  return fractions.map((fraction) => {
    const arc = fraction * circumference;
    const dash = Math.max(arc - gapLen, 0.5);
    const offset = -cursor;
    cursor += arc;
    return { dash, gap: circumference - dash, offset };
  });
}
