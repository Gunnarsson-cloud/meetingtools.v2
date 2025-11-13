import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Meeting Recap Assistant",
  description: "Summarise meetings into clear notes and optional audio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
