import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-bold text-stone-100 mb-4">Page not found</h1>
      <p className="text-stone-400 mb-8">
        The trail goes cold here. Let&apos;s head back.
      </p>
      <Link
        href="/"
        className="rounded bg-amber-600 px-6 py-2 text-stone-950 font-semibold hover:bg-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        Return home
      </Link>
    </main>
  );
}
