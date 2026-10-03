import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Docker Messages",
  description: "A tiny app for learning Docker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
