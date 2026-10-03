// Per-symbol knowledge that isn't in any exported file: which sector an equity
// or ETF belongs to. It lives in `symbols.json` next to the rest of the data (gitignored
// `data/` for real use, `demo-data/` for the demo) rather than in code,
// so the source never names what's actually held. demo-data/symbols.json
// shows the shape.

export interface SymbolConfig {
  /** DEGIRO symbol → sector name from SECTOR_ORDER. */
  sectors: Record<string, string>;
}

let config: SymbolConfig = { sectors: {} };

export function symbolConfig(): SymbolConfig {
  return config;
}

/** Load /symbols.json once, before the first render. A missing or malformed
 * file is not an error: every equity just falls into "Other". */
export async function loadSymbolConfig(): Promise<void> {
  try {
    const res = await fetch("/symbols.json");
    if (!res.ok) return;
    const json = (await res.json()) as Partial<SymbolConfig>;
    config = { sectors: json.sectors ?? {} };
  } catch {
    // Keep the empty config.
  }
}
