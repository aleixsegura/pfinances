import { useState } from "react";
import { LANGUAGES, useTranslation, type Lang } from "./i18n/LanguageContext";

const globe = (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
  </svg>
);

const LABEL_CODE: Record<Lang, string> = { en: "EN", ca: "CA", es: "ES" };

export default function LanguageToggle() {
  const { lang, setLang, t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.language.label}
        title={t.language.label}
        className="flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-[13px] font-medium text-secondary hover:border-hairline hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-focus md:group-data-[collapsed=true]:justify-center md:group-data-[collapsed=true]:px-0 max-md:w-auto"
      >
        <span className="shrink-0">{globe}</span>
        <span className="max-md:hidden md:group-data-[collapsed=true]:hidden">{LABEL_CODE[lang]}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t.language.label}
          className="absolute bottom-full left-0 z-20 mb-1 min-w-[9rem] list-none rounded-md border border-hairline-strong bg-elevated p-1 shadow-pop max-md:bottom-auto max-md:top-full"
        >
          {LANGUAGES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={lang === code}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-focus ${
                  lang === code ? "bg-hover text-primary" : "text-secondary hover:bg-hover hover:text-primary"
                }`}
              >
                {t.language[code]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
