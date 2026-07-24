// Force rebuild v2
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opservor HQ",
  description: "Founder Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
