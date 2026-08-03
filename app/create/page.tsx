"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CharacterCreation } from "@/components/character-creation/CharacterCreation";
import type { CharacterDraft } from "@/game/core/character-creation";
import { buildInitialGameState } from "@/game/core/character-creation";
import { GameStateSchema } from "@/game/schemas/game-state";
import { seedToState } from "@/game/core/rng";
import { writeSave } from "@/game/core/save-helpers";

export default function CreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(
    (draft: CharacterDraft) => {
      const rawState = buildInitialGameState(draft);
      const result = GameStateSchema.safeParse(rawState);
      if (!result.success) {
        setError("Failed to build valid game state. Please try again.");
        console.error("Failed to build valid GameState", result.error);
        return;
      }
      const rng = seedToState(draft.seed);
      writeSave(sessionStorage, rawState, rng);
      router.push("/play");
    },
    [router],
  );

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
          <h1
            className="mt-4 text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Create your character
          </h1>
          <p
            className="mt-2 text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            You are stranded in Pensacola. Your family farm near Butternut needs
            you. Who you are shapes every choice between here and home.
          </p>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 text-sm bg-red-900/30 text-red-300 rounded"
          >
            {error}
          </div>
        )}
        <CharacterCreation onComplete={handleComplete} />
      </div>
    </main>
  );
}
