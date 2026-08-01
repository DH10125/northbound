import type { Metadata } from "next";
import "./globals.css";
import { SkipNav } from "@/components/ui/SkipNav";
import { LiveRegion } from "@/components/ui/LiveRegion";

export const metadata: Metadata = {
  title: "Northbound",
  description:
    "A narrative survival-management game. Reach your family farm before it's too late.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Skip-navigation: first interactive element in tab order */}
        <SkipNav targetId="main-content" />

        {/* Global polite live region for turn results / AT announcements */}
        <LiveRegion />

        {/* Responsive shell: fluid at 320px, constrained at max-width */}
        <div className="min-h-[100svh] flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
