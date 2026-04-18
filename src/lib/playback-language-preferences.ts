import type {
  AppPreferencesStore,
  SeriesLanguageOverride,
} from "./persist-store";

// ---------------------------------------------------------------------------
// Curated language list for playback-preference dropdowns & display badges
// ---------------------------------------------------------------------------

export interface LanguageOption {
  code: string;
  label: string;
}

/**
 * Curated list of languages suitable for playback-preference selectors.
 * Values are IETF-style primary subtags; labels are user-facing names.
 */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "hi", label: "Hindi" },
  { code: "ko", label: "Korean" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ml", label: "Malayalam" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Indonesian" },
] as const;

/** Fast lookup map: lowercase code → label */
const _codeLabelMap = new Map<string, string>(
  LANGUAGE_OPTIONS.map((o) => [o.code, o.label])
);

/**
 * Convert a language code (or raw stream language string) to a user-facing
 * label.  Handles BCP-47 tags (e.g. "en-US"), uppercased stream codes
 * (e.g. "JPN", "ENG"), and falls back to title-casing the input when
 * the code is not in the curated list.
 */
export function getLanguageLabel(code: string | null | undefined): string {
  if (!code) {
    return "Unknown";
  }
  const trimmed = code.trim();
  if (!trimmed) {
    return "Unknown";
  }

  const lower = trimmed.toLowerCase();

  // Direct match
  const direct = _codeLabelMap.get(lower);
  if (direct) {
    return direct;
  }

  // Primary subtag match (e.g. "en-US" → "en")
  const primary = lower.split("-")[0];
  const byPrimary = _codeLabelMap.get(primary);
  if (byPrimary) {
    return byPrimary;
  }

  // ISO 639-2/B three-letter codes commonly seen in media streams
  const iso639Map: Record<string, string> = {
    eng: "en",
    jpn: "ja",
    hin: "hi",
    kor: "ko",
    tam: "ta",
    tel: "te",
    mal: "ml",
    spa: "es",
    fre: "fr",
    fra: "fr",
    ger: "de",
    deu: "de",
    ita: "it",
    por: "pt",
    zho: "zh",
    chi: "zh",
    ara: "ar",
    rus: "ru",
    tha: "th",
    ind: "id",
  };
  const mapped = iso639Map[lower];
  if (mapped) {
    const label = _codeLabelMap.get(mapped);
    if (label) {
      return label;
    }
  }

  // Fallback: title-case the raw input so it looks reasonable in the UI
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Original helpers (unchanged)
// ---------------------------------------------------------------------------

/** Sentinel value indicating subtitles should be turned off. */
export const SUBTITLE_OFF = "__off__" as const;

export const DEFAULT_AUDIO_LANGUAGE = "en";
export const DEFAULT_SUBTITLE_LANGUAGE = "en";

/**
 * Normalize a language code to lowercase trimmed form.
 * Returns undefined for empty/nullish input.
 */
export function normalizeLanguageCode(
  code: string | null | undefined
): string | undefined {
  const trimmed = code?.trim().toLowerCase();
  return trimmed || undefined;
}

/**
 * Extract the primary language subtag (e.g. "en" from "en-US").
 */
function primarySubtag(code: string): string {
  return code.split("-")[0];
}

/**
 * Check whether two language codes match after normalization.
 * Matches by primary subtag so "en" matches "en-US" and vice-versa.
 */
export function languageCodesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeLanguageCode(a);
  const nb = normalizeLanguageCode(b);
  if (na === undefined || nb === undefined) {
    return false;
  }
  return na === nb || primarySubtag(na) === primarySubtag(nb);
}

/**
 * Find the best track matching a language preference.
 * Tries exact match first, then primary-subtag match.
 */
export function findTrackByLanguage<T extends { lang?: string }>(
  tracks: T[],
  language: string | undefined
): T | undefined {
  if (!language) {
    return;
  }
  const norm = normalizeLanguageCode(language);
  if (!norm) {
    return;
  }
  // Exact match first
  const exact = tracks.find((t) => normalizeLanguageCode(t.lang) === norm);
  if (exact) {
    return exact;
  }
  // Primary subtag match
  const primary = primarySubtag(norm);
  return tracks.find((t) => {
    const tl = normalizeLanguageCode(t.lang);
    return tl != null && primarySubtag(tl) === primary;
  });
}

/**
 * Resolve the effective audio/subtitle language for a given series,
 * falling back to global defaults.
 */
export function resolveLanguagePreferences(
  prefs: Pick<
    AppPreferencesStore,
    | "defaultAudioLanguage"
    | "defaultSubtitleLanguage"
    | "seriesLanguageOverrides"
  >,
  seriesId?: string | null
): { audioLanguage: string; subtitleLanguage: string } {
  const override: SeriesLanguageOverride | undefined = seriesId
    ? prefs.seriesLanguageOverrides[seriesId]
    : undefined;

  return {
    audioLanguage:
      normalizeLanguageCode(override?.audioLanguage) ??
      prefs.defaultAudioLanguage,
    subtitleLanguage:
      normalizeLanguageCode(override?.subtitleLanguage) ??
      prefs.defaultSubtitleLanguage,
  };
}
