import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import en, { type Translations } from "./en";
import ca from "./ca";
import es from "./es";

export const LANGUAGES = ["en", "ca", "es"] as const;
export type Lang = (typeof LANGUAGES)[number];

const DICTS: Record<Lang, Translations> = { en, ca, es };

const KEY = "language";

function load(): Lang {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "ca" || raw === "es" ? raw : "en";
  } catch {
    return "en";
  }
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(load);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: language still applies, just not persisted */
    }
  };

  const value = useMemo(() => ({ lang, setLang, t: DICTS[lang] }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used inside <LanguageProvider>");
  return ctx;
}
