"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteNavigation from "../site-navigation";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error != null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "Nie udało się pobrać rozmowy.";
}

export default function ConversationPreview({ conversationId }: { conversationId: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadConversation() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Sesja wygasła. Zaloguj się ponownie.");
        }

        const { data: conversationData, error: conversationError } = await supabase
          .from("conversations")
          .select("id, title, updated_at")
          .eq("id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (conversationError) throw conversationError;
        if (!conversationData) throw new Error("Nie znaleziono tej rozmowy.");

        const { data: messageData, error: messageError } = await supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (messageError) throw messageError;
        if (!isMounted) return;

        setConversation(conversationData as Conversation);
        setMessages(
          ((messageData ?? []) as Message[]).filter(
            (message) => message.role === "user" || message.role === "assistant",
          ),
        );
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadConversation();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  return (
    <main className="history-shell">
      <SiteNavigation />
      <section className="history-panel conversation-preview-panel" aria-label="Podgląd rozmowy">
        <header className="conversation-preview-header">
          <div>
            <Link className="history-back" href="/history">← Wróć do listy</Link>
            <h1>{conversation?.title?.trim() || "Rozmowa z agentem"}</h1>
            <span>{conversation ? formatDate(conversation.updated_at) : ""}</span>
          </div>
          <Link className="history-new-chat" href={`/chat?conversation=${encodeURIComponent(conversationId)}`}>
            🔄 Kontynuuj rozmowę
          </Link>
        </header>

        {isLoading ? <div className="history-loading-list" role="status">Wczytywanie rozmowy...</div> : null}
        {error ? <p className="history-error-panel">{error}</p> : null}
        {!isLoading && !error ? (
          <div className="conversation-message-list">
            {messages.length === 0 ? <p className="history-empty-text">Ta rozmowa nie ma jeszcze wiadomości.</p> : null}
            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <article className={`history-message ${isUser ? "history-message-user" : "history-message-agent"}`} key={message.id}>
                  <span>{isUser ? "Ty" : "Agent"} · {formatTime(message.created_at)}</span>
                  <p>{message.content}</p>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
