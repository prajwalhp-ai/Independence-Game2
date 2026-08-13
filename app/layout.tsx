import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Independence Day Game | Orange Health Labs",
  description: "Match the states — Independence Day celebration game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-800">{children}</body>
    </html>
  );
}
