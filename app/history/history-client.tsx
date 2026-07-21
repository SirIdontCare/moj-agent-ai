"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SiteNavigation from "../site-navigation";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type StoredMessage = {
  conversation_id: string;
  content: string;
  created_at: string;
};

type ConversationSummary = Conversation & {
  messageCount: number;
  preview: string;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error != null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Nie udało się pobrać historii rozmów.";
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));

  if (diffMinutes < 1) return "przed chwilą";
  if (diffMinutes < 60) return `${diffMinutes} min temu`;
  if (diffMinutes < 120) return "godzinę temu";
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)} godz. temu`;
  if (diffMinutes < 48 * 60) return "wczoraj";

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getPreview(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 100 ? `${normalized.slice(0, 97).trimEnd()}...` : normalized;
}

export default function HistoryClient() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data: conversationData, error: conversationError } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (conversationError) {
        throw conversationError;
      }

      const rows = (conversationData ?? []) as Conversation[];
      const conversationIds = rows.map((conversation) => conversation.id);
      let messages: StoredMessage[] = [];

      if (conversationIds.length > 0) {
        const { data: messageData, error: messageError } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false });

        if (messageError) {
          throw messageError;
        }

        messages = (messageData ?? []) as StoredMessage[];
      }

      const summaries = new Map<string, { messageCount: number; preview: string }>();

      for (const message of messages) {
        const summary = summaries.get(message.conversation_id) ?? { messageCount: 0, preview: "" };
        summary.messageCount += 1;

        if (!summary.preview) {
          summary.preview = getPreview(message.content);
        }

        summaries.set(message.conversation_id, summary);
      }

      setConversations(
        rows.map((conversation) => ({
          ...conversation,
          messageCount: summaries.get(conversation.id)?.messageCount ?? 0,
          preview: summaries.get(conversation.id)?.preview ?? "Brak wiadomości w rozmowie.",
        })),
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const filteredConversations = useMemo(() => {
    const phrase = search.trim().toLocaleLowerCase("pl-PL");

    if (!phrase) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      `${conversation.title ?? ""} ${conversation.preview}`.toLocaleLowerCase("pl-PL").includes(phrase),
    );
  }, [conversations, search]);

  async function deleteConversation(conversation: ConversationSummary) {
    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(conversation.id);
    setError("");

    try {
      const { error: messageError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversation.id);

      if (messageError) {
        throw messageError;
      }

      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversation.id);

      if (conversationError) {
        throw conversationError;
      }

      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      setNotice("Rozmowa usunięta");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="history-shell">
      <SiteNavigation />
      <section className="history-panel" aria-label="Historia rozmów">
        <header className="history-header">
          <div>
            <p>Twoja pamięć agenta</p>
            <h1>📜 Historia rozmów</h1>
            <span>Wszystkie Twoje rozmowy z agentem</span>
          </div>
          <Link className="history-new-chat" href="/chat">
            + Nowa rozmowa
          </Link>
        </header>

        <label className="history-search">
          <span>🔎</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj w rozmowach..."
            value={search}
          />
        </label>

        {notice ? <p className="history-notice" role="status">{notice}</p> : null}
        {error ? <p className="history-error-panel">{error}</p> : null}

        {isLoading ? (
          <div className="history-loading-list" role="status">Wczytywanie historii...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="history-empty">
            <p>
              {conversations.length === 0
                ? "Nie masz jeszcze żadnych rozmów. Zacznij nową!"
                : "Nie znaleziono rozmów pasujących do wyszukiwania."}
            </p>
            {conversations.length === 0 ? <Link href="/chat">Rozpocznij rozmowę</Link> : null}
          </div>
        ) : (
          <div className="history-list">
            {filteredConversations.map((conversation) => (
              <article className="history-card" key={conversation.id}>
                <Link className="history-card-link" href={`/history/${conversation.id}`}>
                  <strong>{conversation.title?.trim() || "Nowa rozmowa"}</strong>
                  <span>
                    {formatRelativeDate(conversation.updated_at)} · {conversation.messageCount} wiadomości
                  </span>
                  <em>{conversation.preview}</em>
                </Link>
                <button
                  aria-label={`Usuń rozmowę: ${conversation.title ?? "Nowa rozmowa"}`}
                  className="history-delete"
                  disabled={deletingId === conversation.id}
                  onClick={() => void deleteConversation(conversation)}
                  type="button"
                >
                  {deletingId === conversation.id ? "Usuwanie..." : "🗑 Usuń"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
