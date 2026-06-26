import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Трекер задач юриста — OneBusiness",
  description: "Учёт рабочего времени юриста",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
