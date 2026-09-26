// Per-symbol knowledge that isn't in any exported file: which sector an equity
// or ETF belongs to, and which watchlist symbols DEGIRO lists under another
// ticker. It lives in `symbols.json` next to the rest of the data (gitignored
// `watchlists/` for real use, `demo-data/` for the demo) rather than in code,
// so the source never names what's actually held. demo-data/symbols.json
// shows the shape.

export interface SymbolConfig {
  /** Watchlist (or DEGIRO) symbol → sector name from SECTOR_ORDER. */
  sectors: Record<string, string>;
  /** Watchlist symbol → DEGIRO symbol, for the same company on another
   * exchange with a different ticker (prefix matching can't bridge those). */
  degiroAliases: Record<string, string>;
}

let config: SymbolConfig = { sectors: {}, degiroAliases: {} };

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
    config = {
      sectors: json.sectors ?? {},
      degiroAliases: json.degiroAliases ?? {},
    };
  } catch {
    // Keep the empty config.
  }
}
