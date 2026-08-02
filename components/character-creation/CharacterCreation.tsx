/**
 * CharacterCreation — multi-step character creation flow.
 *
 * Steps: Identity → Occupation → Motivation & Weakness → Review
 * Back/forward preserves all selections via local state.
 * Accessible: keyboard navigation, focus management, ARIA labels, reduced-motion safe.
 */

"use client";

import {
  useId,
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";
import type { ReactNode, Dispatch } from "react";
import { Button } from "@/components/ui/Button";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type { OccupationDefinition } from "@/game/content/occupations";
import { OCCUPATIONS, applyAttributeDeltas } from "@/game/content/occupations";
import type { CharacterDraft } from "@/game/core/character-creation";
import { resolvePronounForms } from "@/game/core/pronouns";

// ── Draft state and reducer ───────────────────────────────────────────────────

type Step = "identity" | "occupation" | "motivation" | "review";

const STEPS: Step[] = ["identity", "occupation", "motivation", "review"];
const STEP_LABELS: Record<Step, string> = {
  identity: "Identity",
  occupation: "Occupation",
  motivation: "Story",
  review: "Review",
};

interface DraftState {
  step: Step;
  name: string;
  pronouns: CharacterDraft["pronouns"];
  customPronouns: string;
  ageRange: CharacterDraft["ageRange"];
  portraitIndex: number;
  occupationId: string;
  motivation: string;
  weakness: string;
  difficulty: "story" | "normal" | "hard";
}

type DraftAction =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_PRONOUNS"; value: CharacterDraft["pronouns"] }
  | { type: "SET_CUSTOM_PRONOUNS"; value: string }
  | { type: "SET_AGE_RANGE"; value: CharacterDraft["ageRange"] }
  | { type: "SET_PORTRAIT_INDEX"; value: number }
  | { type: "SET_OCCUPATION_ID"; value: string }
  | { type: "SET_MOTIVATION"; value: string }
  | { type: "SET_WEAKNESS"; value: string }
  | { type: "SET_DIFFICULTY"; value: "story" | "normal" | "hard" }
  | { type: "NEXT" }
  | { type: "BACK" };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.value };
    case "SET_PRONOUNS":
      return { ...state, pronouns: action.value };
    case "SET_CUSTOM_PRONOUNS":
      return { ...state, customPronouns: action.value };
    case "SET_AGE_RANGE":
      return { ...state, ageRange: action.value };
    case "SET_PORTRAIT_INDEX":
      return { ...state, portraitIndex: action.value };
    case "SET_OCCUPATION_ID":
      return { ...state, occupationId: action.value };
    case "SET_MOTIVATION":
      return { ...state, motivation: action.value };
    case "SET_WEAKNESS":
      return { ...state, weakness: action.value };
    case "SET_DIFFICULTY":
      return { ...state, difficulty: action.value };
    case "NEXT": {
      const idx = STEPS.indexOf(state.step);
      return idx < STEPS.length - 1
        ? { ...state, step: STEPS[idx + 1]! }
        : state;
    }
    case "BACK": {
      const idx = STEPS.indexOf(state.step);
      return idx > 0 ? { ...state, step: STEPS[idx - 1]! } : state;
    }
    default:
      return state;
  }
}

const initialDraft: DraftState = {
  step: "identity",
  name: "",
  pronouns: "they/them",
  customPronouns: "",
  ageRange: "adult",
  portraitIndex: 0,
  occupationId: "",
  motivation: "",
  weakness: "",
  difficulty: "normal" as CharacterDraft["difficulty"],
};

// ── Validation helpers ────────────────────────────────────────────────────────

function validateIdentity(draft: DraftState): string | null {
  if (!draft.name.trim()) return "Name is required.";
  if (draft.name.trim().length > 64)
    return "Name must be 64 characters or fewer.";
  if (draft.pronouns === "custom" && !draft.customPronouns.trim()) {
    return "Custom pronouns are required.";
  }
  return null;
}

function validateOccupation(draft: DraftState): string | null {
  if (!draft.occupationId) return "Please choose an occupation.";
  return null;
}

function validateMotivation(draft: DraftState): string | null {
  if (!draft.motivation.trim()) return "Motivation is required.";
  if (!draft.weakness.trim()) return "Weakness is required.";
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FieldsetProps {
  legend: string;
  children: ReactNode;
  className?: string;
}

function Fieldset({ legend, children, className = "" }: FieldsetProps) {
  return (
    <fieldset className={`border-0 p-0 m-0 ${className}`}>
      <legend
        className="text-sm font-semibold mb-2"
        style={{ color: "var(--text-secondary)" }}
      >
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

interface RadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
  badge?: string;
}

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
  description,
  badge,
}: RadioOptionProps) {
  return (
    <label
      className={[
        "flex items-start gap-3 p-3 rounded-[var(--radius-lg)] cursor-pointer",
        "border transition-colors duration-[var(--duration-fast)]",
        checked
          ? "border-[var(--interactive-primary)] bg-[var(--surface-overlay)]"
          : "border-[var(--surface-border-subtle)] hover:bg-[var(--surface-raised)]",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-[var(--interactive-primary)] flex-shrink-0"
      />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            {label}
          </span>
          {badge && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)] font-medium"
              style={{
                background: "var(--color-ember-700)",
                color: "var(--color-ember-200)",
              }}
            >
              {badge}
            </span>
          )}
        </span>
        {description && (
          <span
            className="text-xs leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

// ── Step: Identity ────────────────────────────────────────────────────────────

interface IdentityStepProps {
  draft: DraftState;
  dispatch: Dispatch<DraftAction>;
  headingId: string;
  error: string | null;
}

const AGE_RANGE_OPTIONS: {
  value: CharacterDraft["ageRange"];
  label: string;
}[] = [
  { value: "teen", label: "Teen (15–17)" },
  { value: "young-adult", label: "Young adult (18–25)" },
  { value: "adult", label: "Adult (26–40)" },
  { value: "middle-age", label: "Middle age (41–59)" },
  { value: "older", label: "Older (60+)" },
];

const PRONOUN_OPTIONS: { value: CharacterDraft["pronouns"]; label: string }[] =
  [
    { value: "they/them", label: "they/them" },
    { value: "she/her", label: "she/her" },
    { value: "he/him", label: "he/him" },
    { value: "custom", label: "Custom…" },
  ];

const PORTRAIT_COUNT = 8;

function IdentityStep({
  draft,
  dispatch,
  headingId,
  error,
}: IdentityStepProps) {
  const nameId = useId();
  const customPronounsId = useId();
  const portraitGroupId = useId();

  return (
    <section aria-labelledby={headingId}>
      <div className="space-y-6">
        {/* Name */}
        <div>
          <label
            htmlFor={nameId}
            className="block text-sm font-semibold mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Name
          </label>
          <input
            id={nameId}
            type="text"
            value={draft.name}
            onChange={(e) =>
              dispatch({ type: "SET_NAME", value: e.target.value })
            }
            maxLength={64}
            autoComplete="off"
            placeholder="Your character's name"
            className={[
              "w-full px-3 py-2 rounded-[var(--radius-md)] text-base",
              "bg-[var(--surface-overlay)] border",
              "focus:outline-[length:var(--focus-ring-width)] focus:outline-[var(--focus-ring-color)] focus:outline-offset-[var(--focus-ring-offset)]",
              error && draft.name.trim() === ""
                ? "border-[var(--interactive-danger)]"
                : "border-[var(--surface-border)]",
            ].join(" ")}
            style={{ color: "var(--text-primary)" }}
            aria-required="true"
            aria-describedby={
              error && draft.name.trim() === "" ? `${nameId}-error` : undefined
            }
          />
          <div className="flex justify-between mt-1">
            {error && draft.name.trim() === "" ? (
              <span
                id={`${nameId}-error`}
                role="alert"
                className="text-xs"
                style={{ color: "var(--interactive-danger)" }}
              >
                {error}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {draft.name.length}/64
            </span>
          </div>
        </div>

        {/* Pronouns */}
        <Fieldset legend="Pronouns">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRONOUN_OPTIONS.map((opt) => (
              <RadioOption
                key={opt.value}
                name="pronouns"
                value={opt.value}
                checked={draft.pronouns === opt.value}
                onChange={() =>
                  dispatch({ type: "SET_PRONOUNS", value: opt.value })
                }
                label={opt.label}
              />
            ))}
          </div>
          {draft.pronouns === "custom" && (
            <div className="mt-3">
              <label
                htmlFor={customPronounsId}
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Custom pronouns (e.g., xe/xem)
              </label>
              <input
                id={customPronounsId}
                type="text"
                value={draft.customPronouns}
                onChange={(e) =>
                  dispatch({
                    type: "SET_CUSTOM_PRONOUNS",
                    value: e.target.value,
                  })
                }
                maxLength={32}
                placeholder="xe/xem"
                className={[
                  "w-full px-3 py-2 rounded-[var(--radius-md)] text-sm",
                  "bg-[var(--surface-overlay)] border",
                  "focus:outline-[length:var(--focus-ring-width)] focus:outline-[var(--focus-ring-color)] focus:outline-offset-[var(--focus-ring-offset)]",
                  error &&
                  draft.pronouns === "custom" &&
                  !draft.customPronouns.trim()
                    ? "border-[var(--interactive-danger)]"
                    : "border-[var(--surface-border)]",
                ].join(" ")}
                style={{ color: "var(--text-primary)" }}
                aria-required={draft.pronouns === "custom"}
              />
            </div>
          )}
        </Fieldset>

        {/* Age range */}
        <Fieldset legend="Age range">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AGE_RANGE_OPTIONS.map((opt) => (
              <RadioOption
                key={opt.value}
                name="ageRange"
                value={opt.value}
                checked={draft.ageRange === opt.value}
                onChange={() =>
                  dispatch({ type: "SET_AGE_RANGE", value: opt.value })
                }
                label={opt.label}
              />
            ))}
          </div>
        </Fieldset>

        {/* Portrait */}
        <Fieldset legend="Silhouette / portrait">
          <div
            role="radiogroup"
            aria-labelledby={portraitGroupId}
            className="flex flex-wrap gap-2"
          >
            <span id={portraitGroupId} className="sr-only">
              Choose a portrait silhouette (index 0–7)
            </span>
            {Array.from({ length: PORTRAIT_COUNT }, (_, i) => (
              <label
                key={i}
                className="cursor-pointer focus-within:outline focus-within:outline-[length:var(--focus-ring-width)] focus-within:outline-[var(--focus-ring-color)] focus-within:outline-offset-[var(--focus-ring-offset)] rounded-full"
              >
                <input
                  type="radio"
                  name="portraitIndex"
                  value={i}
                  checked={draft.portraitIndex === i}
                  onChange={() =>
                    dispatch({ type: "SET_PORTRAIT_INDEX", value: i })
                  }
                  className="sr-only"
                />
                <span
                  aria-label={`Portrait ${i + 1}`}
                  className={[
                    "flex items-center justify-center w-12 h-12 rounded-full border-2 text-base select-none",
                    "transition-colors duration-[var(--duration-fast)]",
                    draft.portraitIndex === i
                      ? "border-[var(--interactive-primary)] bg-[var(--surface-overlay)]"
                      : "border-[var(--surface-border)] hover:border-[var(--interactive-primary)]",
                  ].join(" ")}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {i + 1}
                </span>
              </label>
            ))}
          </div>
        </Fieldset>
      </div>
    </section>
  );
}

// ── Step: Occupation ──────────────────────────────────────────────────────────

interface OccupationCardProps {
  occupation: OccupationDefinition;
  selected: boolean;
  onSelect: () => void;
}

function OccupationCard({
  occupation,
  selected,
  onSelect,
}: OccupationCardProps) {
  const attrs = applyAttributeDeltas(occupation.attributeDeltas);
  const attrEntries = Object.entries(attrs) as [string, number][];

  return (
    <label
      className={[
        "block p-4 rounded-[var(--radius-lg)] cursor-pointer border transition-colors duration-[var(--duration-fast)]",
        "focus-within:outline focus-within:outline-[length:var(--focus-ring-width)] focus-within:outline-[var(--focus-ring-color)] focus-within:outline-offset-[var(--focus-ring-offset)]",
        selected
          ? "border-[var(--interactive-primary)] bg-[var(--surface-overlay)]"
          : "border-[var(--surface-border-subtle)] hover:bg-[var(--surface-raised)]",
      ].join(" ")}
    >
      <input
        type="radio"
        name="occupationId"
        value={occupation.id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="font-bold text-base"
          style={{ color: "var(--text-primary)" }}
        >
          {occupation.name}
        </span>
        {occupation.isChallenge && (
          <span
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded-[var(--radius-sm)] font-semibold"
            style={{
              background: "var(--color-ember-700)",
              color: "var(--color-ember-200)",
            }}
          >
            Challenge
          </span>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        {occupation.description}
      </p>

      {/* Attribute bars */}
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3"
        aria-label="Derived attributes"
      >
        {attrEntries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="text-xs w-16 capitalize flex-shrink-0"
              style={{ color: "var(--text-tertiary)" }}
            >
              {key.replace(/([A-Z])/g, " $1").trim()}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--surface-border)" }}
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(val / 10) * 100}%`,
                  background:
                    val >= 7
                      ? "var(--status-ok-color)"
                      : val >= 4
                        ? "var(--status-info-color)"
                        : "var(--status-warn-color)",
                }}
              />
            </div>
            <span
              className="text-xs w-4 text-right"
              style={{ color: "var(--text-tertiary)" }}
              aria-label={`${key} ${val} out of 10`}
            >
              {val}
            </span>
          </div>
        ))}
      </div>

      {/* Strengths and tradeoffs */}
      <details className="text-xs" open={selected}>
        <summary
          className="cursor-pointer font-medium mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          Strengths &amp; tradeoffs
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <span
              className="font-semibold"
              style={{ color: "var(--color-safe-400)" }}
            >
              Strengths
            </span>
            <ul
              className="mt-1 space-y-0.5 list-disc list-inside"
              style={{ color: "var(--text-tertiary)" }}
            >
              {occupation.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <span
              className="font-semibold"
              style={{ color: "var(--color-ember-400)" }}
            >
              Tradeoffs
            </span>
            <ul
              className="mt-1 space-y-0.5 list-disc list-inside"
              style={{ color: "var(--text-tertiary)" }}
            >
              {occupation.tradeoffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </label>
  );
}

interface OccupationStepProps {
  draft: DraftState;
  dispatch: Dispatch<DraftAction>;
  headingId: string;
  error: string | null;
}

function OccupationStep({
  draft,
  dispatch,
  headingId,
  error,
}: OccupationStepProps) {
  return (
    <section aria-labelledby={headingId}>
      {error && (
        <p
          role="alert"
          className="mb-4 text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{
            background: "var(--surface-overlay)",
            color: "var(--interactive-danger)",
            border: "1px solid var(--interactive-danger)",
          }}
        >
          {error}
        </p>
      )}
      <div
        role="radiogroup"
        aria-label="Choose an occupation"
        className="space-y-3"
      >
        {OCCUPATIONS.map((occ) => (
          <OccupationCard
            key={occ.id}
            occupation={occ}
            selected={draft.occupationId === occ.id}
            onSelect={() =>
              dispatch({ type: "SET_OCCUPATION_ID", value: occ.id })
            }
          />
        ))}
      </div>
    </section>
  );
}

// ── Step: Motivation & Weakness ───────────────────────────────────────────────

interface MotivationStepProps {
  draft: DraftState;
  dispatch: Dispatch<DraftAction>;
  headingId: string;
  error: string | null;
}

const DIFFICULTY_OPTIONS: {
  value: CharacterDraft["difficulty"];
  label: string;
  description: string;
}[] = [
  {
    value: "story",
    label: "Guided",
    description:
      "More information, slower resource drain, higher margins. Recommended for first runs.",
  },
  {
    value: "normal",
    label: "Standard",
    description:
      "Intended experience: challenging but achievable with careful choices.",
  },
  {
    value: "hard",
    label: "Unforgiving",
    description:
      "Less information, faster pressure, thinner margins. For experienced players.",
  },
];

function MotivationStep({
  draft,
  dispatch,
  headingId,
  error,
}: MotivationStepProps) {
  const motivationId = useId();
  const weaknessId = useId();

  const forms = resolvePronounForms(draft.pronouns, draft.customPronouns);
  const pronounDisplay =
    draft.pronouns === "custom"
      ? draft.customPronouns.trim() || "they/them"
      : draft.pronouns;

  const characterRef = draft.name.trim() || "Your character";

  return (
    <section aria-labelledby={headingId}>
      <div className="space-y-6">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {characterRef} ({pronounDisplay}) has just survived the first hours of
          the crisis in Pensacola. What drives {forms.object} toward Butternut —
          and what holds {forms.object} back?
        </p>

        {/* Motivation */}
        <div>
          <label
            htmlFor={motivationId}
            className="block text-sm font-semibold mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Motivation
          </label>
          <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
            Why does {characterRef} have to reach the farm? What would be lost
            if {forms.subject} failed?
          </p>
          <textarea
            id={motivationId}
            value={draft.motivation}
            onChange={(e) =>
              dispatch({ type: "SET_MOTIVATION", value: e.target.value })
            }
            maxLength={256}
            rows={3}
            placeholder="e.g. My parents are alone on the farm. If I don't get there, no one will."
            className={[
              "w-full px-3 py-2 rounded-[var(--radius-md)] text-sm resize-none",
              "bg-[var(--surface-overlay)] border",
              "focus:outline-[length:var(--focus-ring-width)] focus:outline-[var(--focus-ring-color)] focus:outline-offset-[var(--focus-ring-offset)]",
              error && !draft.motivation.trim()
                ? "border-[var(--interactive-danger)]"
                : "border-[var(--surface-border)]",
            ].join(" ")}
            style={{ color: "var(--text-primary)" }}
            aria-required="true"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {draft.motivation.length}/256
            </span>
          </div>
        </div>

        {/* Weakness */}
        <div>
          <label
            htmlFor={weaknessId}
            className="block text-sm font-semibold mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Weakness
          </label>
          <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
            What does {characterRef} struggle with — not as a stat, but as a
            person?
          </p>
          <textarea
            id={weaknessId}
            value={draft.weakness}
            onChange={(e) =>
              dispatch({ type: "SET_WEAKNESS", value: e.target.value })
            }
            maxLength={256}
            rows={3}
            placeholder="e.g. I freeze up when someone gets hurt. It's been that way since my brother's accident."
            className={[
              "w-full px-3 py-2 rounded-[var(--radius-md)] text-sm resize-none",
              "bg-[var(--surface-overlay)] border",
              "focus:outline-[length:var(--focus-ring-width)] focus:outline-[var(--focus-ring-color)] focus:outline-offset-[var(--focus-ring-offset)]",
              error && !draft.weakness.trim()
                ? "border-[var(--interactive-danger)]"
                : "border-[var(--surface-border)]",
            ].join(" ")}
            style={{ color: "var(--text-primary)" }}
            aria-required="true"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {draft.weakness.length}/256
            </span>
          </div>
        </div>

        {/* Difficulty */}
        <Fieldset legend="Difficulty">
          <div className="space-y-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <RadioOption
                key={opt.value}
                name="difficulty"
                value={opt.value}
                checked={draft.difficulty === opt.value}
                onChange={() =>
                  dispatch({ type: "SET_DIFFICULTY", value: opt.value })
                }
                label={opt.label}
                description={opt.description}
              />
            ))}
          </div>
        </Fieldset>
      </div>
    </section>
  );
}

// ── Step: Review ──────────────────────────────────────────────────────────────

interface ReviewStepProps {
  draft: DraftState;
  headingId: string;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt
        className="flex-shrink-0 w-32 font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </dt>
      <dd style={{ color: "var(--text-primary)" }}>{value}</dd>
    </div>
  );
}

function ReviewStep({ draft, headingId }: ReviewStepProps) {
  const occupation = OCCUPATIONS.find((o) => o.id === draft.occupationId);
  const pronounDisplay =
    draft.pronouns === "custom"
      ? draft.customPronouns.trim() || "(custom)"
      : draft.pronouns;

  return (
    <section aria-labelledby={headingId}>
      <dl
        className="space-y-3 p-4 rounded-[var(--radius-lg)]"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--surface-border-subtle)",
        }}
      >
        <ReviewRow label="Name" value={draft.name.trim() || "(none)"} />
        <ReviewRow label="Pronouns" value={pronounDisplay} />
        <ReviewRow
          label="Age range"
          value={draft.ageRange.replace(/-/g, " ")}
        />
        <ReviewRow
          label="Portrait"
          value={`Silhouette ${draft.portraitIndex + 1}`}
        />
        <ReviewRow label="Occupation" value={occupation?.name ?? "(none)"} />
        {occupation?.isChallenge && (
          <div
            className="text-xs px-3 py-2 rounded-[var(--radius-md)]"
            style={{
              background: "var(--surface-overlay)",
              color: "var(--color-ember-300)",
            }}
          >
            Tourist is a deliberate challenge mode — attributes are weaker but
            resolve and social start higher. The journey is harder, the margins
            thinner, and completion is genuinely earned.
          </div>
        )}
        <ReviewRow
          label="Difficulty"
          value={
            (
              {
                story: "Guided",
                normal: "Standard",
                hard: "Unforgiving",
              } as Record<string, string>
            )[draft.difficulty] ?? draft.difficulty
          }
        />
        <div
          className="pt-2 border-t"
          style={{ borderColor: "var(--surface-border-subtle)" }}
        >
          <dt
            className="text-sm font-medium mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Motivation
          </dt>
          <dd className="text-sm" style={{ color: "var(--text-primary)" }}>
            {draft.motivation.trim() || "(none)"}
          </dd>
        </div>
        <div>
          <dt
            className="text-sm font-medium mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Weakness
          </dt>
          <dd className="text-sm" style={{ color: "var(--text-primary)" }}>
            {draft.weakness.trim() || "(none)"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface CharacterCreationProps {
  onComplete: (draft: CharacterDraft) => void;
}

export function CharacterCreation({ onComplete }: CharacterCreationProps) {
  const [state, dispatch] = useReducer(draftReducer, initialDraft);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const stepIndex = STEPS.indexOf(state.step);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  // Validation error for the current step
  const stepError: string | null =
    state.step === "identity"
      ? null // lazy validation on submit
      : state.step === "occupation"
        ? null
        : state.step === "motivation"
          ? null
          : null;

  // Track submitted attempt so we show inline errors after first submit
  const [attempted, setAttempted] = useState(false);

  const currentError: string | null = attempted
    ? state.step === "identity"
      ? validateIdentity(state)
      : state.step === "occupation"
        ? validateOccupation(state)
        : state.step === "motivation"
          ? validateMotivation(state)
          : null
    : null;

  // Focus heading when step changes
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const handleNext = useCallback(() => {
    setAttempted(true);
    const err =
      state.step === "identity"
        ? validateIdentity(state)
        : state.step === "occupation"
          ? validateOccupation(state)
          : state.step === "motivation"
            ? validateMotivation(state)
            : null;
    if (err) return;
    setAttempted(false);
    dispatch({ type: "NEXT" });
  }, [state]);

  const handleBack = useCallback(() => {
    setAttempted(false);
    dispatch({ type: "BACK" });
  }, []);

  const handleBegin = useCallback(() => {
    const seed = `run-${Date.now()}-${Math.floor(Math.random() * 0xffff).toString(16)}`;
    const runStartedAt = new Date().toISOString();
    const draft: CharacterDraft = {
      name: state.name.trim(),
      pronouns: state.pronouns,
      ...(state.pronouns === "custom"
        ? { customPronouns: state.customPronouns.trim() }
        : {}),
      ageRange: state.ageRange,
      portraitIndex: state.portraitIndex,
      occupationId: state.occupationId as CharacterDraft["occupationId"],
      motivation: state.motivation.trim(),
      weakness: state.weakness.trim(),
      difficulty: state.difficulty,
      seed,
      runStartedAt,
    };
    onComplete(draft);
  }, [state, onComplete]);

  const STEP_HEADINGS: Record<Step, string> = {
    identity: "Who are you?",
    occupation: "What did you do before?",
    motivation: "What drives you — and what holds you back?",
    review: "Ready to begin?",
  };

  void stepError;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress indicator */}
      <nav aria-label="Character creation steps" className="mb-8">
        <ol className="flex items-center gap-2" role="list">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="w-6 h-px flex-shrink-0"
                  style={{ background: "var(--surface-border)" }}
                />
              )}
              <span
                className={[
                  "text-xs font-medium px-2 py-1 rounded-[var(--radius-sm)]",
                  i === stepIndex
                    ? "text-[var(--interactive-primary-text)] bg-[var(--interactive-primary)]"
                    : i < stepIndex
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-disabled)]",
                ].join(" ")}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                {STEP_LABELS[step]}
                {i < stepIndex && <VisuallyHidden> (completed)</VisuallyHidden>}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Step heading */}
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold mb-6 focus:outline-none"
        style={{ color: "var(--text-primary)" }}
      >
        {STEP_HEADINGS[state.step]}
      </h2>

      {/* Step content */}
      {state.step === "identity" && (
        <IdentityStep
          draft={state}
          dispatch={dispatch}
          headingId={headingId}
          error={currentError}
        />
      )}
      {state.step === "occupation" && (
        <OccupationStep
          draft={state}
          dispatch={dispatch}
          headingId={headingId}
          error={currentError}
        />
      )}
      {state.step === "motivation" && (
        <MotivationStep
          draft={state}
          dispatch={dispatch}
          headingId={headingId}
          error={currentError}
        />
      )}
      {state.step === "review" && (
        <ReviewStep draft={state} headingId={headingId} />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 gap-4">
        {!isFirst ? (
          <Button variant="secondary" onClick={handleBack}>
            ← Back
          </Button>
        ) : (
          <span />
        )}
        {!isLast ? (
          <Button variant="primary" onClick={handleNext}>
            Next →
          </Button>
        ) : (
          <Button variant="primary" onClick={handleBegin}>
            Begin the journey
          </Button>
        )}
      </div>
    </div>
  );
}
