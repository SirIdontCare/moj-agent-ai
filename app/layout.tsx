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
  title: "Agent AI — Zleć cel. Agent zrobi resztę.",
  description:
    "Jeden autonomiczny agent do researchu, dokumentów, obliczeń, obrazów i gotowych materiałów. Bez przełączania modułów.",
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
    title: "Agent AI — Zleć cel. Agent zrobi resztę.",
    description: "Jeden czat. Wszystkie narzędzia. Od celu do zweryfikowanego, gotowego rezultatu.",
    images: [
      {
        url: "/og-image-v2.png",
        width: 1730,
        height: 909,
        alt: "Agent AI — Zleć cel. Agent zrobi resztę.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent AI — Zleć cel. Agent zrobi resztę.",
    description: "Jeden czat. Wszystkie narzędzia. Od celu do gotowego rezultatu.",
    images: ["/og-image-v2.png"],
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
