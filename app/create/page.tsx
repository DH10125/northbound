"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CharacterCreation } from "@/components/character-creation/CharacterCreation";
import type { CharacterDraft } from "@/game/core/character-creation";
import { buildInitialGameState } from "@/game/core/character-creation";
import { GameStateSchema } from "@/game/schemas/game-state";

export default function CreatePage() {
  const [created, setCreated] = useState(false);
  const [name, setName] = useState("");

  const handleComplete = useCallback((draft: CharacterDraft) => {
    // Build and validate the initial game state — throws if invalid.
    const rawState = buildInitialGameState(draft);
    const result = GameStateSchema.safeParse(rawState);
    if (!result.success) {
      // This should never happen; schema issues would be a bug.
      console.error("Failed to build valid GameState", result.error);
      return;
    }
    // TODO #7: persist state and navigate to game screen
    setName(draft.name);
    setCreated(true);
  }, []);

  if (created) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="w-full max-w-2xl space-y-6 text-center">
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Ready, {name}.
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            The journey north begins. Gameplay is not yet available — check back as development continues.
          </p>
          <Link
            href="/"
            className="inline-block text-sm underline"
            style={{ color: "var(--text-link)" }}
          >
            ← Return to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col items-start px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="w-full max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm"
            style={{ color: "var(--text-link)" }}
          >
            ← Back to home
          </Link>
          <h1 className="mt-4 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Create your character
          </h1>
          <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
            You are stranded in Pensacola. Your family farm near Butternut needs you.
            Who you are shapes every choice between here and home.
          </p>
        </div>
        <CharacterCreation onComplete={handleComplete} />
      </div>
    </main>
  );
}
