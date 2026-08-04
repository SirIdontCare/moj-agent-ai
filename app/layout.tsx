import type { Metadata } from "next";
import AuthGate from "./auth-gate";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Marta AI — Twoja wiedza. Twoja przewaga.",
  description:
    "Osobista doradczyni AI, która zna Twoje dokumenty, pamięta kontekst i pomaga podejmować trafne decyzje.",
  applicationName: "Marta AI",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: "/",
    siteName: "Marta AI",
    title: "Marta AI — Twoja wiedza. Twoja przewaga.",
    description: "Doradczyni AI, która zna Twoją firmę i odpowiada na podstawie Twoich dokumentów.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Marta AI — Twoja wiedza. Twoja przewaga.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marta AI — Twoja wiedza. Twoja przewaga.",
    description: "Doradczyni AI, która zna Twoją firmę i odpowiada na podstawie Twoich dokumentów.",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090d" },
  ],
};

const themeScript = `
  try {
    var savedTheme = localStorage.getItem("marta-theme");
    document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-theme="dark" lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
