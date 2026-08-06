import type { Metadata } from "next";
import AuthGate from "./auth-gate";
import { PwaInstallProvider } from "./pwa-install";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Agent AI — Myśl, twórz i działaj szybciej.",
  description:
    "Uniwersalny agent AI, który zna Twoje dokumenty, pamięta kontekst i pomaga w codziennej pracy.",
  applicationName: "Agent AI",
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
    siteName: "Agent AI",
    title: "Agent AI — Myśl, twórz i działaj szybciej.",
    description: "Uniwersalny agent AI, który zna Twoją firmę i odpowiada na podstawie Twoich dokumentów.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Agent AI — Myśl, twórz i działaj szybciej.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent AI — Myśl, twórz i działaj szybciej.",
    description: "Uniwersalny agent AI, który zna Twoją firmę i odpowiada na podstawie Twoich dokumentów.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Agent AI",
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
    var savedTheme = localStorage.getItem("agent-theme");
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
        <PwaInstallProvider>
          <AuthGate>{children}</AuthGate>
        </PwaInstallProvider>
      </body>
    </html>
  );
}
