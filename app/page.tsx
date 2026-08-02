import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConditionPreview } from "@/components/conditions/ConditionPreview";

export default function Home() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="w-full max-w-2xl space-y-10 text-center">
        <header>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Northbound
          </h1>
          <p
            className="mt-4 text-lg sm:text-xl leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            A narrative survival-management game. Stranded in Pensacola, you
            must reach your family farm near Butternut before it&apos;s too
            late.
          </p>
        </header>

        <section
          aria-labelledby="principles-heading"
          className="text-left space-y-4 rounded-[var(--radius-lg)] p-6"
          style={{
            border: "1px solid var(--surface-border)",
            background: "var(--surface-raised)",
          }}
        >
          <h2
            id="principles-heading"
            className="text-lg font-semibold text-center"
            style={{ color: "var(--text-primary)" }}
          >
            Product principles
          </h2>
          <ul
            className="space-y-3 text-sm list-none"
            style={{ color: "var(--text-secondary)" }}
          >
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

        {/* Condition system preview — interactive demo */}
        <section
          aria-labelledby="condition-demo-heading"
          className="text-left space-y-3 rounded-[var(--radius-lg)] p-6"
          style={{
            border: "1px solid var(--surface-border-subtle)",
            background: "var(--surface-inset)",
          }}
        >
          <h2
            id="condition-demo-heading"
            className="text-sm font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            Condition system preview
          </h2>
          <ConditionPreview />
        </section>

        {/* Status indicator demo — non-colour status for accessibility */}
        <section
          aria-labelledby="status-demo-heading"
          className="text-left space-y-3 rounded-[var(--radius-lg)] p-6"
          style={{
            border: "1px solid var(--surface-border-subtle)",
            background: "var(--surface-inset)",
          }}
        >
          <h2
            id="status-demo-heading"
            className="text-sm font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            Status system preview
          </h2>
          <div className="flex flex-wrap gap-4">
            <StatusBadge status="ok" label="Health" value="82%" />
            <StatusBadge status="warn" label="Water" value="Low" />
            <StatusBadge status="danger" label="Farm" value="Critical" />
            <StatusBadge status="info" label="Weather" value="Clear" />
            <StatusBadge status="neutral" label="Phase" value="Day" />
          </div>
        </section>

        <div className="pt-4 flex flex-col items-center gap-3">
          <a
            href="/create"
            className={[
              "inline-flex items-center justify-center gap-2 px-5 py-2.5",
              "text-[length:var(--text-lg)] font-semibold rounded-[var(--radius-lg)]",
              "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]",
              "hover:bg-[var(--interactive-primary-hover)]",
              "transition-colors duration-[var(--duration-fast)]",
              "focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)]",
            ].join(" ")}
          >
            Create a character
          </a>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Early development — character creation is available; gameplay is not
            yet implemented.
          </p>
        </div>
      </div>
    </main>
  );
}
