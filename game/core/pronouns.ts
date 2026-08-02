/**
 * Pronoun utilities — subject, object, and possessive forms for all
 * built-in pronoun sets and validated custom representations.
 *
 * No React / browser dependencies.
 */

/** Subject / object / possessive triple for a pronoun set. */
export interface PronounForms {
  /** Nominative subject form, e.g. "they", "she", "he". */
  subject: string;
  /** Accusative object form, e.g. "them", "her", "him". */
  object: string;
  /** Dependent possessive form, e.g. "their", "her", "his". */
  possessive: string;
}

const BUILT_IN_FORMS: Record<string, PronounForms> = {
  "they/them": { subject: "they", object: "them", possessive: "their" },
  "she/her": { subject: "she", object: "her", possessive: "her" },
  "he/him": { subject: "he", object: "him", possessive: "his" },
};

/**
 * Parse a custom pronoun string (e.g. "xe/xem/xyr" or "xe/xem") into forms.
 *
 * Accepts:
 *   - Three segments: subject/object/possessive
 *   - Two segments: subject/object (possessive defaults to object + "'s")
 *   - One segment: treated as subject; object and possessive default to it
 *
 * Falls back to they/them if the string is empty.
 */
function parseCustomPronouns(raw: string): PronounForms {
  const trimmed = raw.trim();
  if (!trimmed) return BUILT_IN_FORMS["they/them"]!;

  const parts = trimmed.split("/").map((p) => p.trim());
  const [subject = trimmed, object = subject, possessive = `${object}'s`] =
    parts;
  return { subject, object, possessive };
}

/**
 * Resolve pronoun forms for a player record.
 * Always returns valid PronounForms — never throws.
 */
export function resolvePronounForms(
  pronouns: "they/them" | "she/her" | "he/him" | "custom",
  customPronouns?: string,
): PronounForms {
  if (pronouns !== "custom") {
    return BUILT_IN_FORMS[pronouns] ?? BUILT_IN_FORMS["they/them"]!;
  }
  return parseCustomPronouns(customPronouns ?? "");
}
