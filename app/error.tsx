"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-bold text-stone-100 mb-4">
        Something went wrong
      </h1>
      <p className="text-stone-400 mb-8">
        An unexpected error occurred. Your progress is safe.
      </p>
      <button
        onClick={reset}
        className="rounded bg-amber-600 px-6 py-2 text-stone-950 font-semibold hover:bg-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        Try again
      </button>
    </main>
  );
}
