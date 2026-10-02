import type { Metadata } from "next";
import "./globals.css";
import "./explorer.css";

export const metadata: Metadata = {
  title: "California Gas Price Explorer",
  description: "Compare California and U.S. regular gasoline prices using official EIA history and BLS inflation data, with accessible sources and exports.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
