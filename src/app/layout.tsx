import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ИРИС - помощник пациента",
  description: "Портал восстановления для пациентов больницы.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
