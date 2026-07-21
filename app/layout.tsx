import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marta - profesjonalna doradczyni podatkowa",
  description:
    "Ekspert AI od PIT, VAT, ryczałtu, kosztów firmowych i rozliczeń B2B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
