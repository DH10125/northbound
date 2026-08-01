import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-stone-950 text-stone-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
