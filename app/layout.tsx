import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Meeting Recap Assistant",
  description: "Generate meeting notes and optional audio recap.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
