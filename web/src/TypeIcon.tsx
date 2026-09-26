import { useTranslation } from "./i18n/LanguageContext";
import type { Translations } from "./i18n/en";

interface Props {
  symbol: string;
  symbolType: string;
}

function labelFor(t: Translations, symbolType: string): string {
  switch (symbolType) {
    case "EQUITY":
      return t.typeIcon.stock;
    case "ETF":
      return t.typeIcon.etf;
    case "MUTUAL_FUND":
      return t.typeIcon.mutualFund;
    case "CRYPTO_CURRENCY":
      return t.typeIcon.crypto;
    case "CURRENCY":
      return t.typeIcon.currency;
    case "INDEX":
      return t.typeIcon.index;
    default:
      return t.typeIcon.other;
  }
}

const commonProps = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Brand glyphs for specific coins — recognizable at a glance beats a generic
// "crypto" symbol for the two coins we actually hold. Monochrome (currentColor)
// to match the rest of the type icons rather than using brand colors.
const BRAND_ICONS: Record<string, { label: string; node: JSX.Element }> = {
  "BTC-USD": {
    label: "Bitcoin",
    node: (
      <svg viewBox="0 0 384 512" width={16} height={16} fill="currentColor">
        <path d="M310.204 242.638c27.73-14.18 45.377-39.39 41.28-81.3-5.358-57.351-52.458-76.573-114.85-81.929V0h-48.528v77.203c-12.605 0-25.525.315-38.444.63V0h-48.528v79.409c-17.842.539-38.622.276-97.37 0v51.678c38.314-.678 58.417-3.14 63.023 21.427v217.429c-2.925 19.492-18.524 16.685-53.255 16.071L3.765 443.68c88.481 0 97.37.315 97.37.315V512h48.528v-67.06c13.234.315 26.154.315 38.444.315V512h48.528v-68.005c81.299-4.412 135.647-24.894 142.895-101.467 5.671-61.446-23.32-88.862-69.326-99.89zM150.608 134.553c27.415 0 113.126-8.507 113.126 48.528 0 54.515-85.71 48.212-113.126 48.212v-96.74zm0 251.776V279.821c32.772 0 133.127-9.138 133.127 53.255-.001 60.186-100.355 53.253-133.127 53.253z" />
      </svg>
    ),
  },
  "ETH-USD": {
    label: "Ethereum",
    node: (
      <svg {...commonProps}>
        <polygon points="12 1 4 12 12 16.5 20 12" />
        <polygon points="12 16.5 4 12 12 23 20 12" />
      </svg>
    ),
  },
};

function glyphFor(symbolType: string) {
  switch (symbolType) {
    case "EQUITY":
      // Candlesticks — the universal "stock" shorthand.
      return (
        <svg {...commonProps}>
          <line x1="6" y1="3" x2="6" y2="7" />
          <rect x="4.5" y="7" width="3" height="6" rx="0.6" />
          <line x1="6" y1="13" x2="6" y2="19" />
          <line x1="12" y1="2" x2="12" y2="5.5" />
          <rect x="10.5" y="5.5" width="3" height="9.5" rx="0.6" />
          <line x1="12" y1="15" x2="12" y2="21" />
          <line x1="18" y1="5" x2="18" y2="9" />
          <rect x="16.5" y="9" width="3" height="5" rx="0.6" />
          <line x1="18" y1="14" x2="18" y2="18" />
        </svg>
      );
    case "ETF":
      return (
        <svg {...commonProps}>
          <polygon points="12 3 21 8 12 13 3 8" />
          <polyline points="3 13 12 18 21 13" />
        </svg>
      );
    case "MUTUAL_FUND":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5V12l7.36 4.25" />
        </svg>
      );
    case "CRYPTO_CURRENCY":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9c0-1.1 1.1-2 2.5-2s2.5.75 2.5 1.75c0 2.5-5.5 1-5.5 3.5 0 1 1.15 1.75 3 1.75s2.5-.75 2.5-1.75" />
          <line x1="12" y1="6.5" x2="12" y2="17.5" />
        </svg>
      );
    case "CURRENCY":
      return (
        <svg {...commonProps}>
          <path d="M4 8h13M17 8l-3-3M17 8l-3 3" />
          <path d="M20 16H7M7 16l3-3M7 16l3 3" />
        </svg>
      );
    case "INDEX":
      return (
        <svg {...commonProps}>
          <polyline points="3 17 9 11 13 15 21 6" />
          <circle cx="21" cy="6" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export default function TypeIcon({ symbol, symbolType }: Props) {
  const { t } = useTranslation();
  const iconClass =
    "inline-flex size-[18px] items-center justify-center align-middle text-secondary [&_svg]:size-full";

  const brand = BRAND_ICONS[symbol];
  if (brand) {
    return (
      <span className={iconClass} title={brand.label} aria-label={brand.label}>
        {brand.node}
      </span>
    );
  }

  const label = labelFor(t, symbolType);
  return (
    <span className={iconClass} title={label} aria-label={label}>
      {glyphFor(symbolType)}
    </span>
  );
}
