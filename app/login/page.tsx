"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "register";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const redirectTo = searchParams.get("redirect")?.startsWith("/")
    ? searchParams.get("redirect")!
    : "/";

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectTo);
    });
  }, [redirectTo, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setNotice("Konto utworzone. Sprawdź email i potwierdź rejestrację, a następnie się zaloguj.");
          setMode("login");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Nie udało się zalogować.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">⚡</div>
        <p className="login-eyebrow">PRYWATNY AGENT AI</p>
        <h1 id="login-title">{mode === "login" ? "Witaj ponownie" : "Utwórz konto"}</h1>
        <p className="login-description">
          {mode === "login"
            ? "Zaloguj się, aby otworzyć swoje rozmowy i dokumenty."
            : "Każde konto ma osobną historię rozmów i bazę wiedzy."}
        </p>

        <div className="login-tabs" role="tablist" aria-label="Tryb formularza">
          <button
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
            role="tab"
            type="button"
          >
            Logowanie
          </button>
          <button
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => changeMode("register")}
            role="tab"
            type="button"
          >
            Rejestracja
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ty@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Hasło</span>
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={isSubmitting}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 znaków"
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="login-message login-error" role="alert">{error}</p> : null}
          {notice ? <p className="login-message login-notice" role="status">{notice}</p> : null}

          <button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? "Proszę czekać..."
              : mode === "login"
                ? "Zaloguj się"
                : "Zarejestruj się"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-loading" role="status">
          <div className="auth-spinner" />
          <p>Ładuję logowanie...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
