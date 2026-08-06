"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

type PwaInstallContextValue = {
  installPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIos: boolean;
  requestInstall: () => Promise<"accepted" | "dismissed" | "instructions">;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function detectStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function detectIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsInstalled(detectStandalone());
    setIsIos(detectIos());

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Nie udało się zarejestrować PWA:", error);
      });
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function requestInstall() {
    if (!installPrompt) {
      return "instructions" as const;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    return choice.outcome;
  }

  return (
    <PwaInstallContext.Provider
      value={{ installPrompt, isInstalled, isIos, requestInstall }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

export default function PwaInstallCard() {
  const context = useContext(PwaInstallContext);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!context || context.isInstalled || isDismissed) {
    return null;
  }

  async function handleInstall() {
    const result = await context!.requestInstall();

    if (result === "instructions" || result === "dismissed") {
      setShowInstructions(true);
    }
  }

  const instructions = context.isIos
    ? "Otwórz w Safari, stuknij Udostępnij, a następnie „Dodaj do ekranu początkowego”."
    : "Otwórz menu przeglądarki (⋮) i wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.";

  return (
    <section className="pwa-install-card" aria-label="Instalacja aplikacji Agent AI">
      <button
        aria-label="Ukryj propozycję instalacji"
        className="pwa-install-dismiss"
        onClick={() => setIsDismissed(true)}
        type="button"
      >
        ×
      </button>
      <div className="pwa-install-icon" aria-hidden="true">✦</div>
      <div className="pwa-install-copy">
        <strong>Agent AI na Twoim telefonie</strong>
        <p>Szybszy dostęp i widok jak w aplikacji.</p>
      </div>
      <button className="pwa-install-action" onClick={() => void handleInstall()} type="button">
        {context.installPrompt ? "Zainstaluj" : "Dodaj do ekranu"}
      </button>
      {showInstructions ? <p className="pwa-install-help">{instructions}</p> : null}
    </section>
  );
}
