export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-stone-100">
          Northbound
        </h1>
        <p className="text-xl text-stone-400 leading-relaxed">
          A narrative survival-management game. Stranded in Pensacola, you must
          reach your family farm near Butternut before it&apos;s too late.
        </p>
        <nav aria-label="Product principles" className="pt-4">
          <ul className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
            <li>
              <a
                href="/docs/game-design"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
              >
                Game design
              </a>
            </li>
            <li>
              <a
                href="/docs/architecture"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
              >
                Architecture
              </a>
            </li>
            <li>
              <a
                href="/docs/roadmap"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
              >
                Roadmap
              </a>
            </li>
          </ul>
        </nav>
        <p className="text-xs text-stone-600 pt-8">
          Early development — nothing to play yet.
        </p>
      </div>
    </main>
  );
}
