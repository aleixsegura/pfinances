import { useEffect, useState } from "react";

export interface ExtraPayment {
  /** "YYYY-MM" month the payment lands in. */
  month: string;
  amountEur: number;
}

export interface GoalSettings {
  flatPriceEur: number;
  monthlySavingsEur: number;
  /** Share of monthly savings that gets invested (0–1); the rest stays cash. */
  investedPct: number;
  /** Notary + registry + gestoría + tasación. */
  fixedCostsEur: number;
  /** Cash reserve excluded from the goal pot and the projection. */
  emergencyFundEur: number;
  /** Keep contributing monthlySavingsEur after the salary guarantee ends (Dec 2027). */
  contributeAfter2027: boolean;
  /** Overrides the 5% central scenario when set (as a fraction, e.g. 0.06). */
  customReturnPct: number | null;
  /** Known one-off savings boosts (pagas extra). */
  extraPayments: ExtraPayment[];
}

// Neutral placeholders. Your own plan (flat price, savings rate, pagas extra…)
// goes in goals.json next to the rest of the data — gitignored watchlists/ —
// so it never lands in the source. Any subset of the fields is fine there.
const BASE_SETTINGS: GoalSettings = {
  flatPriceEur: 250000,
  monthlySavingsEur: 1000,
  investedPct: 1,
  fixedCostsEur: 3000,
  emergencyFundEur: 6000,
  contributeAfter2027: true,
  customReturnPct: null,
  extraPayments: [],
};

let defaults: GoalSettings = BASE_SETTINGS;

/** Load /goals.json once, before the first render. Missing file → placeholders. */
export async function loadGoalDefaults(): Promise<void> {
  try {
    const res = await fetch("/goals.json");
    if (!res.ok) return;
    defaults = { ...BASE_SETTINGS, ...((await res.json()) as Partial<GoalSettings>) };
  } catch {
    // Keep the placeholders.
  }
}

const KEY = "goals.flat.v1";

function load(): GoalSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    // Spread-merge keeps stored files from older versions forward-compatible.
    return { ...defaults, ...(JSON.parse(raw) as Partial<GoalSettings>) };
  } catch {
    return defaults;
  }
}

/** Goal-calculator assumptions, persisted to localStorage on every change. */
export function useGoalSettings() {
  const [settings, setSettings] = useState<GoalSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Storage full or unavailable (private mode) — settings just won't persist.
    }
  }, [settings]);

  const update = (patch: Partial<GoalSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));
  const reset = () => setSettings(defaults);

  return { settings, update, reset };
}
