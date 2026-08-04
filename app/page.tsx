"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import DashboardClient from "./dashboard/dashboard-client";
import { supabase } from "@/lib/supabase";

const features = [
  {
    icon: "✦",
    title: "Pamięta kontekst",
    description: "Wracaj do rozmów bez powtarzania całej historii. Marta pamięta to, co ważne.",
    tone: "violet",
  },
  {
    icon: "▤",
    title: "Zna Twoje dokumenty",
    description: "Odpowiada na podstawie cenników, procedur i materiałów, które jej udostępnisz.",
    tone: "mint",
  },
  {
    icon: "⌾",
    title: "Dane tylko dla Ciebie",
    description: "Każde konto ma prywatną historię rozmów i osobną, bezpieczną bazę wiedzy.",
    tone: "amber",
  },
  {
    icon: "↗",
    title: "Gotowa przez całą dobę",
    description: "Przygotowuje briefingi i porządkuje pracę, także wtedy, kiedy Ty odpoczywasz.",
    tone: "blue",
  },
];

function BrandMark() {
  return (
    <span className="landing-brand-mark" aria-hidden="true">
      M
    </span>
  );
}

function ProductPreview() {
  return (
    <div className="landing-preview" aria-label="Podgląd rozmowy z Martą AI">
      <div className="preview-glow preview-glow-one" />
      <div className="preview-glow preview-glow-two" />
      <div className="preview-window">
        <div className="preview-sidebar">
          <div className="preview-mini-brand">
            <BrandMark />
            <span>Marta AI</span>
          </div>
          <div className="preview-new-chat">＋ Nowa rozmowa</div>
          <div className="preview-nav-item preview-nav-active"><span>⌁</span> Czat</div>
          <div className="preview-nav-item"><span>▤</span> Baza wiedzy</div>
          <div className="preview-nav-item"><span>◷</span> Historia</div>
          <div className="preview-nav-item"><span>◇</span> Briefingi</div>
          <div className="preview-profile">
            <span>AK</span>
            <div><strong>Anna Kowalska</strong><small>anna@firma.pl</small></div>
          </div>
        </div>

        <div className="preview-chat">
          <header className="preview-chat-header">
            <div>
              <span className="preview-status-dot" />
              <strong>Marta</strong>
              <small>Twoja doradczyni AI</small>
            </div>
            <span className="preview-secure">● Dane prywatne</span>
          </header>
          <div className="preview-messages">
            <div className="preview-time">Dzisiaj, 10:42</div>
            <div className="preview-message preview-message-user">
              Który pakiet będzie najlepszy dla zespołu 12 osób?
            </div>
            <div className="preview-answer-row">
              <span className="preview-avatar">M</span>
              <div className="preview-message preview-message-agent">
                <p>Dla zespołu 12 osób najlepiej sprawdzi się <strong>Pakiet Business.</strong></p>
                <div className="preview-answer-grid">
                  <span><small>Miesięcznie</small><strong>499 zł</strong></span>
                  <span><small>W cenie</small><strong>do 15 osób</strong></span>
                </div>
                <p>Otrzymacie też priorytetowe wsparcie i pełny dostęp do raportów.</p>
                <div className="preview-source"><span>▤</span><div><small>ŹRÓDŁO</small><strong>Cennik_firmowy_2026.pdf · str. 3</strong></div></div>
              </div>
            </div>
          </div>
          <div className="preview-composer">
            <span>Zapytaj o dokumenty, klientów lub firmę…</span>
            <button aria-label="Wyślij wiadomość" tabIndex={-1}>↑</button>
          </div>
        </div>
      </div>
      <div className="preview-proof-card preview-proof-card-top">
        <span>✓</span>
        <div><strong>Odpowiedź ze źródłem</strong><small>Bez zgadywania</small></div>
      </div>
      <div className="preview-proof-card preview-proof-card-bottom">
        <span>▤</span>
        <div><strong>12 dokumentów</strong><small>Gotowych do użycia</small></div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Nawigacja strony głównej">
        <Link className="landing-logo" href="/" aria-label="Marta AI — strona główna">
          <BrandMark />
          <span>Marta <em>AI</em></span>
        </Link>
        <div className="landing-nav-links">
          <a href="#mozliwosci">Możliwości</a>
          <a href="#jak-dziala">Jak działa</a>
        </div>
        <Link className="landing-nav-login" href="/login">Zaloguj się <span>→</span></Link>
      </nav>

      <section className="landing-hero">
        <div className="landing-orb landing-orb-one" />
        <div className="landing-orb landing-orb-two" />
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span>✦</span> Inteligencja, która zna Twoją firmę</div>
          <h1>Twoja wiedza.<br /><span>Twoja przewaga.</span></h1>
          <p>
            Marta to osobista doradczyni AI, która zna Twoje dokumenty, pamięta kontekst
            i pomaga podejmować trafne decyzje — w kilka sekund.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" href="/login?mode=register">
              Zacznij za darmo <span>→</span>
            </Link>
            <a className="landing-secondary-cta" href="#jak-dziala">
              <span className="landing-play">▶</span> Zobacz, jak działa
            </a>
          </div>
          <div className="landing-trust-row">
            <div className="landing-avatars" aria-hidden="true">
              <span>MK</span><span>AN</span><span>KP</span>
            </div>
            <div><strong>Dołącz do nowoczesnych zespołów</strong><small>Start zajmuje mniej niż 30 sekund</small></div>
          </div>
        </div>
        <ProductPreview />
      </section>

      <section className="landing-features" id="mozliwosci" aria-labelledby="features-title">
        <div className="landing-section-heading">
          <p>WIĘCEJ NIŻ CHATBOT</p>
          <h2 id="features-title">Jedna asystentka.<br />Cała wiedza Twojej firmy.</h2>
          <span>Marta łączy rozproszone informacje i zamienia je w konkretne odpowiedzi.</span>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <span className={`landing-feature-icon landing-feature-${feature.tone}`} aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="landing-feature-link">Dowiedz się więcej <b>↗</b></span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-demo" id="jak-dziala" aria-labelledby="demo-title">
        <div className="landing-demo-copy">
          <p>OD PYTANIA DO PEWNEJ ODPOWIEDZI</p>
          <h2 id="demo-title">Nie szukaj.<br />Po prostu zapytaj.</h2>
          <span>
            Marta przeszukuje Twoje materiały, wybiera właściwy fragment i zawsze pokazuje,
            skąd pochodzi odpowiedź.
          </span>
          <ul>
            <li><i>01</i><div><strong>Dodaj dokumenty</strong><small>Cenniki, procedury, oferty i notatki.</small></div></li>
            <li><i>02</i><div><strong>Zadaj pytanie po swojemu</strong><small>Bez komend i nauki nowego narzędzia.</small></div></li>
            <li><i>03</i><div><strong>Dostań odpowiedź ze źródłem</strong><small>Konkretnie, szybko i bez domysłów.</small></div></li>
          </ul>
        </div>
        <div className="landing-demo-card">
          <div className="landing-demo-dots"><span /><span /><span /></div>
          <p>Zapytaj o cennik → Marta odpowiada z <strong>Twoich dokumentów</strong></p>
          <div className="landing-demo-question">Jakie warunki rabatowe mamy dla stałych klientów?</div>
          <div className="landing-demo-answer">
            <span className="preview-avatar">M</span>
            <div>
              <p>Stali klienci otrzymują <strong>10% rabatu</strong> przy umowie rocznej lub <strong>15%</strong> przy płatności z góry.</p>
              <small>▤ Polityka_rabatowa.pdf · sekcja 2.1</small>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-orb" />
        <div>
          <p>GOTOWY NA SPOKOJNIEJSZY DZIEŃ?</p>
          <h2>Twoja Marta jest gotowa.<br /><span>Zacznij w 30 sekund.</span></h2>
        </div>
        <Link className="landing-primary-cta landing-primary-cta-light" href="/login?mode=register">
          Stwórz darmowe konto <span>→</span>
        </Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-logo" href="/">
          <BrandMark />
          <span>Marta <em>AI</em></span>
        </Link>
        <p>© 2026 Marta AI. Twoja wiedza pracuje dla Ciebie.</p>
        <div><a href="#mozliwosci">Możliwości</a><Link href="/login">Logowanie</Link></div>
      </footer>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.user);
      setIsCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isCheckingSession) {
    return (
      <main className="auth-loading" role="status">
        <div className="auth-spinner" />
        <p>Przygotowuję Martę...</p>
      </main>
    );
  }

  return user ? <DashboardClient /> : <LandingPage />;
}
