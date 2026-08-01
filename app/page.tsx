export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl w-full space-y-10 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-stone-100">
          Northbound
        </h1>
        <p className="text-xl text-stone-400 leading-relaxed">
          A narrative survival-management game. Stranded in Pensacola, you must
          reach your family farm near Butternut before it&apos;s too late.
        </p>

        <section
          aria-labelledby="principles-heading"
          className="text-left space-y-4 border border-stone-800 rounded-lg p-6"
        >
          <h2
            id="principles-heading"
            className="text-lg font-semibold text-stone-200 text-center"
          >
            Product principles
          </h2>
          <ul className="space-y-3 text-sm text-stone-400 list-none">
            <li>Every run tells a different, coherent survival story.</li>
            <li>
              Avoidance, preparation, empathy, and trade are often better than
              combat.
            </li>
            <li>
              Information is imperfect; consequences are legible and persistent.
            </li>
            <li>
              The collapse is fictional. Real places ground the journey, not
              factual claims about real institutions.
            </li>
            <li>
              Original presentation and mechanics; this is not a visual or
              textual clone of any existing game.
            </li>
          </ul>
        </section>

        <p className="text-xs text-stone-600 pt-4">
          Early development — nothing to play yet.
        </p>
      </div>
    </main>
  );
}
