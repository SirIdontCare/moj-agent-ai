"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import {
  type ClipboardEvent,
  type DragEvent,
  FormEvent,
  type ReactNode,
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SiteNavigation from "./site-navigation";
import { supabase } from "@/lib/supabase";

const chatModes = {
  casual: { emoji: "💬", label: "Casual" },
  ekspert: { emoji: "🎓", label: "Ekspert" },
  kreatywny: { emoji: "🎨", label: "Kreatywny" },
} as const;

const aiModels = {
  flash: { emoji: "⚡", label: "Flash", description: "szybki" },
  pro: { emoji: "🧠", label: "Pro", description: "zaawansowany" },
} as const;

type ChatMode = keyof typeof chatModes;
type AIModel = keyof typeof aiModels;

type ChatClientProps = {
  title: string;
  description: string;
  emptyMessage: string;
  inputPlaceholder: string;
  api: string;
  exampleQuestions: string[];
  quickTerms?: string[];
  renderMarkdown?: boolean;
  requestMode?: string;
  showModeSwitcher?: boolean;
  visionIntro?: boolean;
  toolPanel?: ToolInfo[];
  showToolTimeline?: boolean;
  showReactSteps?: boolean;
  showTravelCards?: boolean;
  showDiagnostics?: boolean;
};

type AttachedImage = {
  filePart: FileUIPart;
  name: string;
  size: number;
};

type ToolInfo = {
  emoji: string;
  name: string;
  status: string;
};

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type KnowledgeCitation = {
  title: string;
  addedAt: string | null;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UserProfile = {
  id: string;
  name: string | null;
  preferences: Record<string, string> | null;
};

const acceptedImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
const maxImageSize = 4 * 1024 * 1024;

function getConversationTitle(text: string) {
  const normalizedText = text.trim().replace(/\s+/g, " ") || "Nowa rozmowa";

  return normalizedText.length > 50
    ? `${normalizedText.slice(0, 47).trimEnd()}...`
    : normalizedText;
}

function getNameFromMessage(text: string) {
  const explicitName = text.match(/(?:mam na imię|nazywam się)\s+([a-ząćęłńóśźż-]{2,40})/i);

  if (explicitName?.[1]) {
    return explicitName[1].trim();
  }

  const introduction = text.match(
    /(?:^|[.!?]\s*|cześć[,!]?\s*)jestem\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż-]{1,39})/,
  );

  return introduction?.[1]?.trim() ?? "";
}

function getSupabaseErrorMessage(error: unknown) {
  if (typeof error === "object" && error != null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message) {
      return message;
    }
  }

  return "Nie udało się połączyć z historią rozmów.";
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getMessageSources(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "source-url")
    .map((part) => ({
      id: part.sourceId,
      title: part.title,
      url: part.url,
    }));
}

function getMessageImages(message: UIMessage) {
  return message.parts.filter(
    (part): part is FileUIPart => part.type === "file" && part.mediaType.startsWith("image/"),
  );
}

function getToolParts(message: UIMessage) {
  return message.parts.filter(
    (part): part is UIMessage["parts"][number] & ToolPart => part.type.startsWith("tool-"),
  );
}

function splitKnowledgeCitations(text: string) {
  const citations: string[] = [];
  const content = text
    .split("\n")
    .filter((line) => {
      const match = line
        .trim()
        .replace(/^\*\*|\*\*$/g, "")
        .match(/^📎\s*Źród(?:ło|ła):\s*(.+)$/i);

      if (!match?.[1]) {
        return true;
      }

      citations.push(
        ...match[1]
          .split(",")
          .map((title) => title.trim())
          .filter(Boolean),
      );
      return false;
    })
    .join("\n")
    .trim();

  return { content, citations };
}

function getKnowledgeCitations(toolParts: ToolPart[], citedTitles: string[]) {
  const toolCitations = new Map<string, KnowledgeCitation>();

  for (const toolPart of toolParts) {
    if (getToolName(toolPart) !== "searchKnowledge" || typeof toolPart.output !== "object" || toolPart.output == null) {
      continue;
    }

    const output = toolPart.output as Record<string, unknown>;
    const results = Array.isArray(output.results) ? output.results : [];

    for (const result of results) {
      if (typeof result !== "object" || result == null) {
        continue;
      }

      const record = result as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";

      if (title) {
        toolCitations.set(title, {
          title,
          addedAt: typeof record.added_at === "string" ? record.added_at : null,
        });
      }
    }
  }

  if (!citedTitles.length) {
    return [];
  }

  return Array.from(new Set(citedTitles)).map(
    (title) => toolCitations.get(title) ?? { title, addedAt: null },
  );
}

function getToolName(part: ToolPart) {
  return part.type.replace("tool-", "");
}

function getToolError(value: unknown) {
  if (typeof value === "object" && value != null) {
    const record = value as Record<string, unknown>;

    if (typeof record.error === "string") {
      return record.error;
    }
  }

  if (typeof value === "string" && /błąd|blad|error|timeout|nie znalazłem|nie mogę|nie udało/i.test(value)) {
    return value;
  }

  return "";
}

function formatToolCall(toolName: string, input: unknown) {
  if (typeof input !== "object" || input == null) {
    return `${toolName}()`;
  }

  const values = Object.values(input as Record<string, unknown>);
  const firstValue = values.find((value) => typeof value === "string" || typeof value === "number");

  if (firstValue == null) {
    return `${toolName}()`;
  }

  return `${toolName}(${JSON.stringify(firstValue)})`;
}

function getToolEmoji(name: string) {
  const emojis: Record<string, string> = {
    calculator: "🧮",
    currentDateTime: "🕐",
    googleSearch: "🌐",
    readWebPage: "📄",
    generateImage: "🎨",
    getWeather: "🌦️",
    getExchangeRate: "💱",
    getHolidays: "📅",
    searchWikipedia: "📚",
    saveNote: "📝",
    getNotes: "🗒️",
    searchKnowledge: "📚",
  };

  return emojis[name] ?? "🛠️";
}

function summarizeValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.length > 180 ? `${value.slice(0, 180)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.error === "string") {
      return record.error;
    }

    if (typeof record.formatted === "string") {
      return record.formatted;
    }

    if (typeof record.text === "string") {
      return record.text.length > 180 ? `${record.text.slice(0, 180)}...` : record.text;
    }

    if (typeof record.warsaw === "string") {
      return record.warsaw;
    }

    try {
      const json = JSON.stringify(value);
      return json.length > 180 ? `${json.slice(0, 180)}...` : json;
    } catch {
      return "Wynik narzędzia";
    }
  }

  return String(value);
}

function getGeneratedImage(output: unknown) {
  if (typeof output !== "object" || output == null) {
    return "";
  }

  const image = (output as Record<string, unknown>).image;

  return typeof image === "string" ? image : "";
}

function downloadDataUrl(dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "ai-generated.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);

  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      lines[index + 1]?.includes("|") &&
      isTableSeparator(lines[index + 1])
    ) {
      const tableLines: string[] = [];

      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const header = splitTableRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitTableRow);

      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table className="markdown-table">
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol className="markdown-list" key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul className="markdown-list" key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={`h3-${index}`}>{renderInlineMarkdown(line.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={`h2-${index}`}>{renderInlineMarkdown(line.slice(3))}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(<h2 key={`h1-${index}`}>{renderInlineMarkdown(line.slice(2))}</h2>);
      index += 1;
      continue;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);
    index += 1;
  }

  return <div className="markdown-content">{blocks}</div>;
}

function getReactSectionKind(title: string) {
  if (title.includes("🧠") || /myślę|mysle/i.test(title)) {
    return "thought";
  }

  if (title.includes("👁️") || /obserwuję|obserwuje/i.test(title)) {
    return "observation";
  }

  if (title.includes("✅") || /wynik/i.test(title)) {
    return "result";
  }

  return "default";
}

function splitReactSections(text: string) {
  const sections: Array<{ title: string; content: string; kind: string }> = [];
  const pattern = /^###\s+(.+)$/gm;
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) {
    return sections;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const title = match[1].trim();
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = nextMatch?.index ?? text.length;
    const content = text.slice(contentStart, contentEnd).trim();

    sections.push({
      title,
      content,
      kind: getReactSectionKind(title),
    });
  }

  return sections;
}

function ReactStepContent({ text, toolCount }: { text: string; toolCount: number }) {
  const sections = splitReactSections(text);
  const mainStepCount = sections.filter((section) => section.kind === "thought").length;
  const hasResult = sections.some((section) => section.kind === "result");
  const currentStep = hasResult ? 5 : Math.min(Math.max(mainStepCount, toolCount, 1), 5);

  if (sections.length === 0) {
    return <MarkdownContent text={text} />;
  }

  return (
    <div className="react-steps">
      <div className="react-progress" aria-label={`Krok ${currentStep} z 5`}>
        <span>Krok {currentStep} z 5</span>
        <div>
          <i style={{ width: `${(currentStep / 5) * 100}%` }} />
        </div>
      </div>
      {sections.map((section, index) => (
        <section
          className={`react-section react-section-${section.kind}`}
          key={`${section.title}-${index}`}
        >
          <h3>{section.title}</h3>
          {section.content ? <MarkdownContent text={section.content} /> : null}
        </section>
      ))}
    </div>
  );
}

function getTravelSectionKind(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (title.includes("🌤️") || normalizedTitle.includes("pogoda")) {
    return "weather";
  }

  if (title.includes("💰") || normalizedTitle.includes("budżet") || normalizedTitle.includes("budzet")) {
    return "budget";
  }

  if (title.includes("📅") || normalizedTitle.includes("daty") || normalizedTitle.includes("święta")) {
    return "dates";
  }

  if (title.includes("🏛️") || normalizedTitle.includes("zobaczyć") || normalizedTitle.includes("atrakc")) {
    return "attractions";
  }

  if (title.includes("✅") || normalizedTitle.includes("checklist")) {
    return "checklist";
  }

  if (title.includes("📋") || normalizedTitle.includes("podsumowanie")) {
    return "summary";
  }

  return "default";
}

function splitTravelSections(text: string) {
  const titleMatch = text.match(/^##\s+(.+)$/m);
  const pattern = /^###\s+(.+)$/gm;
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) {
    return {
      title: titleMatch?.[1]?.trim() ?? "Plan podróży",
      intro: text,
      sections: [] as Array<{ title: string; content: string; kind: string }>,
    };
  }

  const firstMatchIndex = matches[0].index ?? 0;
  const intro = text.slice(0, firstMatchIndex).replace(/^##\s+.+$/m, "").trim();
  const sections = matches.map((match, index) => {
    const nextMatch = matches[index + 1];
    const title = match[1].trim();
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = nextMatch?.index ?? text.length;

    return {
      title,
      content: text.slice(contentStart, contentEnd).trim(),
      kind: getTravelSectionKind(title),
    };
  });

  return {
    title: titleMatch?.[1]?.trim() ?? "Plan podróży",
    intro,
    sections,
  };
}

function TravelPlanContent({ text }: { text: string }) {
  const plan = splitTravelSections(text);

  if (plan.sections.length === 0) {
    return <MarkdownContent text={text} />;
  }

  return (
    <div className="travel-plan">
      <header className="travel-plan-header">
        <span aria-hidden="true">✈️</span>
        <h2>{plan.title}</h2>
      </header>
      {plan.intro ? <MarkdownContent text={plan.intro} /> : null}
      <div className="travel-card-grid">
        {plan.sections.map((section, index) => (
          <section
            className={`travel-card travel-card-${section.kind}`}
            key={`${section.title}-${index}`}
          >
            <h3>{section.title}</h3>
            {section.content ? <MarkdownContent text={section.content} /> : null}
          </section>
        ))}
      </div>
    </div>
  );
}

function DiagnosticsPanel({
  duration,
  isGenerating,
  message,
}: {
  duration: number;
  isGenerating: boolean;
  message?: UIMessage;
}) {
  const toolParts = message ? getToolParts(message) : [];
  const maxSteps = 5;
  const stepCount = Math.min(toolParts.length, maxSteps);
  const progressPercent = (stepCount / maxSteps) * 100;
  const progressTone = stepCount >= 5 ? "danger" : stepCount >= 4 ? "warning" : "good";
  const toolCounts = toolParts.reduce<Record<string, number>>((counts, toolPart) => {
    const toolName = getToolName(toolPart);

    counts[toolName] = (counts[toolName] ?? 0) + 1;

    return counts;
  }, {});
  const errors = toolParts
    .map((toolPart) => {
      const toolName = getToolName(toolPart);
      const error = toolPart.errorText || getToolError(toolPart.output);

      return error
        ? {
            call: formatToolCall(toolName, toolPart.input),
            error,
          }
        : null;
    })
    .filter((error): error is { call: string; error: string } => error != null);
  const toolSummary = Object.entries(toolCounts)
    .map(([toolName, count]) => `${toolName}(${count})`)
    .join(", ");
  const status = isGenerating
    ? stepCount >= maxSteps
      ? "⚠️ Limit kroków"
      : "W trakcie..."
    : message
      ? "✅ Status: Zadanie ukończone"
      : "Oczekuje na zadanie";

  return (
    <section className="diagnostics-panel" aria-label="Diagnostyka agenta">
      <h2>🛡️ Diagnostyka</h2>
      <div className="diagnostics-grid">
        <span>Kroki</span>
        <div className="diagnostics-progress-row">
          <div className={`diagnostics-progress diagnostics-progress-${progressTone}`}>
            <i style={{ width: `${progressPercent}%` }} />
          </div>
          <strong>
            {stepCount}/{maxSteps}
          </strong>
        </div>
        <span>Narzędzia</span>
        <strong>{toolSummary || "brak"}</strong>
        <span>Błędy</span>
        <strong>{errors.length}</strong>
        <span>Czas</span>
        <strong>{duration ? `${duration.toFixed(1)}s` : "0.0s"}</strong>
      </div>
      <p className="diagnostics-status">{status}</p>
      {errors.length > 0 ? (
        <div className="diagnostics-alerts">
          {errors.map((error, index) => (
            <p key={`${error.call}-${index}`}>
              🔴 {error.call} — {error.error}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function ChatClient({
  title,
  description,
  emptyMessage,
  inputPlaceholder,
  api,
  exampleQuestions,
  quickTerms = [],
  renderMarkdown = false,
  requestMode,
  showModeSwitcher = true,
  visionIntro = false,
  toolPanel = [],
  showToolTimeline = false,
  showReactSteps = false,
  showTravelCards = false,
  showDiagnostics = false,
}: ChatClientProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("casual");
  const [model, setModel] = useState<AIModel>("flash");
  const [messageModes, setMessageModes] = useState<Record<string, ChatMode>>({});
  const [messageModels, setMessageModels] = useState<Record<string, AIModel>>({});
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [exportStatus, setExportStatus] = useState("");
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [messageDurations, setMessageDurations] = useState<Record<string, number>>({});
  const [diagnosticElapsed, setDiagnosticElapsed] = useState(0);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [requestedConversationId, setRequestedConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingModeRef = useRef<ChatMode>("casual");
  const pendingModelRef = useRef<AIModel>("flash");
  const pendingStartedAtRef = useRef<number | null>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const isCreatingConversationRef = useRef<Promise<string | null> | null>(null);
  const conversationHasUserMessageRef = useRef(false);
  const handledMessageIdsRef = useRef(new Set<string>());
  const userIdRef = useRef<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api }), [api]);
  const { messages, sendMessage, setMessages, status, error } = useChat({ transport });

  const isGenerating = status === "submitted" || status === "streaming";
  const isChatBusy = isGenerating || isHistoryLoading || isProfileLoading;
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          getMessageText(message).trim().length > 0 ||
          getMessageImages(message).length > 0 ||
          getToolParts(message).length > 0,
      ),
    [messages],
  );
  const conversationStats = useMemo(() => {
    const characters = visibleMessages.reduce(
      (total, message) => total + getMessageText(message).length,
      0,
    );

    return {
      messages: visibleMessages.length,
      tokens: Math.ceil(characters / 4),
    };
  }, [visibleMessages]);
  const lastAssistantMessage = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === "assistant"),
    [visibleMessages],
  );
  const diagnosticsDuration = isGenerating
    ? diagnosticElapsed
    : lastAssistantMessage
      ? (messageDurations[lastAssistantMessage.id] ?? 0)
      : 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    setRequestedConversationId(new URLSearchParams(window.location.search).get("conversation"));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadUserProfile() {
      try {
        let userId = localStorage.getItem("user_id");

        if (!userId) {
          userId = crypto.randomUUID();
          localStorage.setItem("user_id", userId);

          const { error: createError } = await supabase
            .from("user_profiles")
            .insert({ id: userId });

          if (createError && createError.code !== "23505") {
            throw createError;
          }
        }

        userIdRef.current = userId;
        const { data, error: profileLoadError } = await supabase
          .from("user_profiles")
          .select("id, name, preferences")
          .eq("id", userId)
          .maybeSingle();

        if (profileLoadError) {
          throw profileLoadError;
        }

        let profileData = data as UserProfile | null;

        if (!profileData) {
          const { data: createdProfile, error: createProfileError } = await supabase
            .from("user_profiles")
            .upsert({ id: userId }, { onConflict: "id" })
            .select("id, name, preferences")
            .single();

          if (createProfileError) {
            throw createProfileError;
          }

          profileData = createdProfile as UserProfile;
        }

        if (isMounted) {
          setProfile(profileData);
        }
      } catch (loadError) {
        if (isMounted) {
          setProfileError(getSupabaseErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    }

    void loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLatestConversation() {
      setIsHistoryLoading(true);

      try {
        const conversationQuery = supabase.from("conversations").select("id");
        const { data: conversation, error: conversationError } = requestedConversationId
          ? await conversationQuery.eq("id", requestedConversationId).maybeSingle()
          : await conversationQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();

        if (conversationError) {
          throw conversationError;
        }

        if (!conversation || !isMounted) {
          if (isMounted) {
            conversationIdRef.current = null;
            conversationHasUserMessageRef.current = false;
            handledMessageIdsRef.current = new Set();
            setMessages([]);
          }

          return;
        }

        const { data: storedMessages, error: messagesError } = await supabase
          .from("messages")
          .select("id, role, content")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });

        if (messagesError) {
          throw messagesError;
        }

        if (!isMounted) {
          return;
        }

        const restoredMessages = ((storedMessages ?? []) as StoredMessage[]).filter(
          (message) => message.role === "user" || message.role === "assistant",
        );

        conversationIdRef.current = conversation.id;
        conversationHasUserMessageRef.current = restoredMessages.some(
          (message) => message.role === "user",
        );
        handledMessageIdsRef.current = new Set(restoredMessages.map((message) => message.id));
        setMessages(
          restoredMessages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: [{ type: "text", text: message.content }],
          })),
        );
      } catch (loadError) {
        if (isMounted) {
          setHistoryError(getSupabaseErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      }
    }

    void loadLatestConversation();

    return () => {
      isMounted = false;
    };
  }, [requestedConversationId, setMessages]);

  const ensureConversation = useCallback(async (firstMessage = "Nowa rozmowa") => {
    if (conversationIdRef.current) {
      return conversationIdRef.current;
    }

    if (isCreatingConversationRef.current) {
      return isCreatingConversationRef.current;
    }

    const createConversation = (async () => {
      const { data, error: createError } = await supabase
        .from("conversations")
        .insert({ title: getConversationTitle(firstMessage) })
        .select("id")
        .single();

      if (createError || !data) {
        setHistoryError(getSupabaseErrorMessage(createError));
        return null;
      }

      conversationIdRef.current = data.id;
      return data.id;
    })();

    isCreatingConversationRef.current = createConversation;
    void createConversation.finally(() => {
      if (isCreatingConversationRef.current === createConversation) {
        isCreatingConversationRef.current = null;
      }
    });

    return createConversation;
  }, []);

  const persistMessage = useCallback(
    async (message: UIMessage) => {
      if (message.role !== "user" && message.role !== "assistant") {
        return;
      }

      const content = getMessageText(message).trim();

      if (!content) {
        return;
      }

      const conversationId = await ensureConversation(
        message.role === "user" ? content : "Nowa rozmowa",
      );

      if (!conversationId) {
        return;
      }

      const isFirstUserMessage =
        message.role === "user" && !conversationHasUserMessageRef.current;

      if (isFirstUserMessage) {
        conversationHasUserMessageRef.current = true;
      }

      const now = new Date().toISOString();
      const [{ error: messageError }, { error: conversationError }] = await Promise.all([
        supabase.from("messages").insert({
          conversation_id: conversationId,
          role: message.role,
          content,
        }),
        supabase
          .from("conversations")
          .update(
            isFirstUserMessage
              ? { title: getConversationTitle(content), updated_at: now }
              : { updated_at: now },
          )
          .eq("id", conversationId),
      ]);

      if (messageError || conversationError) {
        setHistoryError(getSupabaseErrorMessage(messageError ?? conversationError));
      }
    },
    [ensureConversation],
  );

  const saveProfileName = useCallback(async (name: string) => {
    if (!userIdRef.current) {
      return false;
    }

    const { data, error: saveError } = await supabase
      .from("user_profiles")
      .upsert({ id: userIdRef.current, name }, { onConflict: "id" })
      .select("id, name, preferences")
      .single();

    if (saveError) {
      setProfileError(getSupabaseErrorMessage(saveError));
      return false;
    }

    setProfile(data as UserProfile);
    setProfileError("");
    return true;
  }, []);

  useEffect(() => {
    if (isHistoryLoading) {
      return;
    }

    for (const message of messages) {
      const shouldWaitForAssistant = message.role === "assistant" && status !== "ready";
      const hasContent = getMessageText(message).trim().length > 0;

      if (
        shouldWaitForAssistant ||
        !hasContent ||
        handledMessageIdsRef.current.has(message.id)
      ) {
        continue;
      }

      handledMessageIdsRef.current.add(message.id);
      void persistMessage(message);
    }
  }, [isHistoryLoading, messages, persistMessage, status]);

  useEffect(() => {
    if (!isGenerating || !pendingStartedAtRef.current) {
      return;
    }

    const interval = setInterval(() => {
      if (pendingStartedAtRef.current) {
        setDiagnosticElapsed((performance.now() - pendingStartedAtRef.current) / 1000);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    setMessageModes((currentModes) => {
      let changed = false;
      const nextModes = { ...currentModes };

      for (const message of messages) {
        if (message.role === "assistant" && !nextModes[message.id]) {
          nextModes[message.id] = pendingModeRef.current;
          pendingAssistantIdRef.current = message.id;
          changed = true;
        }
      }

      return changed ? nextModes : currentModes;
    });

    setMessageModels((currentModels) => {
      let changed = false;
      const nextModels = { ...currentModels };

      for (const message of messages) {
        if (message.role === "assistant" && !nextModels[message.id]) {
          nextModels[message.id] = pendingModelRef.current;
          changed = true;
        }
      }

      return changed ? nextModels : currentModels;
    });
  }, [messages]);

  useEffect(() => {
    if (status !== "ready" || !pendingStartedAtRef.current || !pendingAssistantIdRef.current) {
      return;
    }

    const duration = (performance.now() - pendingStartedAtRef.current) / 1000;
    const messageId = pendingAssistantIdRef.current;

    setMessageDurations((currentDurations) => ({
      ...currentDurations,
      [messageId]: duration,
    }));
    pendingStartedAtRef.current = null;
    pendingAssistantIdRef.current = null;
  }, [status]);

  function validateImage(file: File) {
    if (!acceptedImageTypes.includes(file.type)) {
      return "Akceptuję tylko PNG, JPG, JPEG, GIF albo WEBP.";
    }

    if (file.size > maxImageSize) {
      return "Max 4MB. Zrób screenshot fragmentu.";
    }

    return "";
  }

  async function readImageFile(file: File) {
    const validationError = validateImage(file);

    if (validationError) {
      setImageError(validationError);
      return;
    }

    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Nie udało się wczytać obrazu."));
      reader.readAsDataURL(file);
    });

    setAttachedImage({
      filePart: {
        type: "file",
        mediaType: file.type,
        filename: file.name || "screenshot",
        url,
      },
      name: file.name || "Screenshot",
      size: file.size,
    });
    setImageError("");
  }

  async function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );

    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();

    if (file) {
      event.preventDefault();
      await readImageFile(file);
    }
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await readImageFile(file);
    }

    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();

    if (!isChatBusy) {
      setIsDraggingFile(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFile(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = Array.from(event.dataTransfer.files).find((droppedFile) =>
      droppedFile.type.startsWith("image/"),
    );

    if (file) {
      await readImageFile(file);
    }
  }

  async function sendUserMessage(text: string) {
    if ((!text && !attachedImage) || isChatBusy) {
      return;
    }

    const textToSend = text || "Opisz ten obraz.";
    const detectedName = getNameFromMessage(textToSend);

    if (detectedName) {
      await saveProfileName(detectedName);
    }

    setInput("");
    setImageError("");
    pendingModeRef.current = mode;
    pendingModelRef.current = model;
    pendingStartedAtRef.current = performance.now();
    setDiagnosticElapsed(0);
    const imageToSend = attachedImage;
    setAttachedImage(null);
    await sendMessage(
      {
        text: textToSend,
        files: imageToSend ? [imageToSend.filePart] : undefined,
      },
      { body: { mode: requestMode ?? mode, model, userId: userIdRef.current } },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendUserMessage(input.trim());
  }

  async function handleExampleQuestion(question: string) {
    await sendUserMessage(question);
  }

  function handleNewConversation() {
    setMessages([]);
    conversationIdRef.current = null;
    conversationHasUserMessageRef.current = false;
    handledMessageIdsRef.current = new Set();
    setMessageModes({});
    setMessageModels({});
    setExportStatus("");
    setAttachedImage(null);
    setImageError("");
    setMessageDurations({});
    setHistoryError("");
    void ensureConversation();
  }

  async function handleExportConversation() {
    const conversation = visibleMessages
      .map((message) => {
        const label = message.role === "user" ? "User" : "Agent";

        return `${label}: ${getMessageText(message)}`;
      })
      .join("\n");

    if (!conversation) {
      return;
    }

    await navigator.clipboard.writeText(conversation);
    setExportStatus("Skopiowano!");

    if (exportTimerRef.current) {
      clearTimeout(exportTimerRef.current);
    }

    exportTimerRef.current = setTimeout(() => setExportStatus(""), 1800);
  }

  return (
    <main
      className={`chat-shell ${isDraggingFile ? "chat-shell-dragging" : ""}`}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingFile ? <div className="drop-overlay">Upuść obraz</div> : null}
      <SiteNavigation />
      <section className="chat-panel" aria-label="Czat z agentem AI">
        <header className="chat-header">
          <h1>{title}</h1>
          <p className="agent-description">{description}</p>
          {toolPanel.length > 0 ? (
            <div className="tool-panel" aria-label="Moje narzędzia">
              <h2>Moje narzędzia</h2>
              <div>
                {toolPanel.map((toolInfo) => (
                  <span className="tool-pill" key={toolInfo.name}>
                    <span aria-hidden="true">{toolInfo.emoji}</span>
                    {toolInfo.name}
                    <strong>{toolInfo.status}</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {profile?.name ? (
            <p className="profile-greeting">👋 Cześć, {profile.name}! Miło Cię znowu widzieć.</p>
          ) : null}
          {exampleQuestions.length > 0 ? (
            <div className="example-questions" aria-label="Przykładowe pytania">
              {exampleQuestions.map((question) => (
                <button
                  disabled={isChatBusy}
                  key={question}
                  onClick={() => handleExampleQuestion(question)}
                  type="button"
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <section className="context-panel" aria-label="Kontekst rozmowy">
          <button
            aria-expanded={isContextOpen}
            className="context-toggle"
            onClick={() => setIsContextOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span>Kontekst rozmowy</span>
            <span aria-hidden="true">{isContextOpen ? "▲" : "▼"}</span>
          </button>

          {isContextOpen ? (
            <div className="context-body">
              <p>
                Wiadomości: {conversationStats.messages} | ~Tokeny:{" "}
                {conversationStats.tokens}
              </p>
              <div className="context-actions">
                <button
                  disabled={isChatBusy}
                  onClick={handleNewConversation}
                  type="button"
                >
                  + Nowa rozmowa
                </button>
                <button
                  disabled={visibleMessages.length === 0}
                  onClick={handleExportConversation}
                  type="button"
                >
                  📋 Eksportuj rozmowę
                </button>
                {exportStatus ? (
                  <span className="copy-status" role="status">
                    {exportStatus}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="model-panel" aria-label="Model AI">
          <span>Model AI</span>
          <div className="model-switcher">
            {(Object.keys(aiModels) as AIModel[]).map((modelName) => {
              const modelConfig = aiModels[modelName];
              const isActive = modelName === model;

              return (
                <button
                  aria-pressed={isActive}
                  className={`model-button ${isActive ? "model-button-active" : ""}`}
                  disabled={isChatBusy}
                  key={modelName}
                  onClick={() => setModel(modelName)}
                  type="button"
                >
                  <span aria-hidden="true">{modelConfig.emoji}</span>
                  {modelConfig.label}
                  <small>{modelConfig.description}</small>
                </button>
              );
            })}
          </div>
        </section>

        <div className="messages" aria-live="polite">
          {isHistoryLoading ? (
            <div className="history-loading" role="status">
              <span aria-hidden="true" className="history-spinner" />
              Wczytywanie ostatniej rozmowy...
            </div>
          ) : visibleMessages.length === 0 ? (
            visionIntro ? (
              <button
                className="vision-drop-zone"
                disabled={isGenerating}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span>📸 Ctrl+V - wklej screenshot</span>
                <span>📁 Kliknij - wybierz plik</span>
                <span>🖱️ Przeciągnij - upuść obraz</span>
              </button>
            ) : (
              <div className="empty-state">
                <p>
                  {profile?.name
                    ? `Cześć, ${profile.name}! W czym mogę Ci dziś pomóc?`
                    : profile
                      ? "Cześć! Nie znamy się jeszcze. Jak masz na imię?"
                      : emptyMessage}
                </p>
              </div>
            )
          ) : (
            visibleMessages.map((message) => {
              const text = getMessageText(message);
              const sources = getMessageSources(message);
              const images = getMessageImages(message);
              const toolParts = getToolParts(message);
              const isUser = message.role === "user";
              const parsedAnswer = isUser
                ? { content: text, citations: [] as string[] }
                : splitKnowledgeCitations(text);
              const knowledgeCitations = isUser
                ? []
                : getKnowledgeCitations(toolParts, parsedAnswer.citations);
              const duration = messageDurations[message.id];
              const messageModel = messageModels[message.id] ?? model;

              return (
                <article
                  className={`message-row ${isUser ? "message-row-user" : ""}`}
                  key={message.id}
                >
                  <div className={`message ${isUser ? "message-user" : "message-ai"}`}>
                    {!isUser ? (
                      <div className="message-badges">
                        {showModeSwitcher ? (
                          <span
                            className={`mode-badge mode-badge-${
                              messageModes[message.id] ?? mode
                            }`}
                          >
                            {chatModes[messageModes[message.id] ?? mode].emoji}{" "}
                            {messageModes[message.id] ?? mode}
                          </span>
                        ) : null}
                        <span
                          className={`model-badge model-badge-${
                            messageModel
                          }`}
                        >
                          {aiModels[messageModel].emoji} {messageModel}
                        </span>
                      </div>
                    ) : null}
                    {!isUser && showToolTimeline && toolParts.length > 0 ? (
                      <div className="tool-timeline">
                        <strong>🤖 Agent wykonuje zadanie...</strong>
                        {toolParts.map((toolPart, toolIndex) => {
                          const toolName = getToolName(toolPart);
                          const outputImage = getGeneratedImage(toolPart.output);

                          return (
                            <div className="tool-step" key={`${toolPart.type}-${toolIndex}`}>
                              <div className="tool-step-title">
                                <span>{toolIndex + 1}</span>
                                <strong>
                                  {getToolEmoji(toolName)} {toolName}
                                </strong>
                                <em>{toolPart.state === "output-available" ? "gotowe" : "pracuje"}</em>
                              </div>
                              {toolPart.input ? (
                                <p className="tool-step-input">{summarizeValue(toolPart.input)}</p>
                              ) : null}
                              {toolPart.state === "output-available" ? (
                                outputImage ? (
                                  <div className="tool-image-result">
                                    <img alt="Wygenerowany obraz" src={outputImage} />
                                    <button
                                      onClick={() => downloadDataUrl(outputImage)}
                                      type="button"
                                    >
                                      💾 Pobierz
                                    </button>
                                  </div>
                                ) : (
                                  <p className="tool-step-output">
                                    → {summarizeValue(toolPart.output)}
                                  </p>
                                )
                              ) : toolPart.errorText ? (
                                <p className="tool-step-output">→ {toolPart.errorText}</p>
                              ) : (
                                <p className="tool-step-output tool-step-loading">→ wykonuję...</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {images.length > 0 ? (
                      <div className="message-images">
                        {images.map((image, imageIndex) => (
                          <img
                            alt={image.filename || "Załączony obraz"}
                            key={`${image.url}-${imageIndex}`}
                            src={image.url}
                          />
                        ))}
                      </div>
                    ) : null}
                    {!isUser && showTravelCards ? (
                      <TravelPlanContent text={parsedAnswer.content} />
                    ) : !isUser && showReactSteps ? (
                      <ReactStepContent text={parsedAnswer.content} toolCount={toolParts.length} />
                    ) : !isUser && renderMarkdown ? (
                      <MarkdownContent text={parsedAnswer.content} />
                    ) : (
                      parsedAnswer.content
                    )}
                    {!isUser && knowledgeCitations.length > 0 ? (
                      <div className="knowledge-citations" aria-label="Źródła z bazy wiedzy">
                        <span>
                          📎 {knowledgeCitations.length === 1 ? "Źródło" : "Źródła"}
                        </span>
                        <div>
                          {knowledgeCitations.map((citation) => (
                            <a
                              href={`/knowledge?document=${encodeURIComponent(citation.title)}`}
                              key={citation.title}
                            >
                              <strong>📄 {citation.title}</strong>
                              {citation.addedAt ? <small>dodano {citation.addedAt}</small> : null}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!isUser && toolParts.length > 0 ? (
                      <div className="tool-stats">
                        Użyto {toolParts.length} narzędzi
                        {duration ? ` | ${duration.toFixed(1)}s` : ""}
                        {" | "}Model: gemini-2.5-flash
                      </div>
                    ) : null}
                    {!isUser && sources.length > 0 ? (
                      <div className="source-list">
                        <span>Źródła:</span>
                        {sources.map((source) => (
                          <a
                            href={source.url}
                            key={source.id}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {source.title || source.url}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}

          {isGenerating ? (
            <div className="thinking" role="status">
              Myślę...
            </div>
          ) : null}

          {error ? <div className="error">Nie udało się pobrać odpowiedzi.</div> : null}
          {historyError ? <div className="history-error">{historyError}</div> : null}
          {profileError ? <div className="history-error">{profileError}</div> : null}
          <div ref={bottomRef} />
        </div>

        {showDiagnostics ? (
          <DiagnosticsPanel
            duration={diagnosticsDuration}
            isGenerating={isGenerating}
            message={lastAssistantMessage}
          />
        ) : null}

        <form className="composer" onSubmit={handleSubmit}>
          {showModeSwitcher ? (
            <div className="mode-switcher" aria-label="Tryb rozmowy">
              {(Object.keys(chatModes) as ChatMode[]).map((modeName) => {
                const modeConfig = chatModes[modeName];
                const isActive = modeName === mode;

                return (
                  <button
                    aria-pressed={isActive}
                    className={`mode-button ${isActive ? "mode-button-active" : ""}`}
                    disabled={isChatBusy}
                    key={modeName}
                    onClick={() => setMode(modeName)}
                    type="button"
                  >
                    <span aria-hidden="true">{modeConfig.emoji}</span>
                    {modeConfig.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {quickTerms.length > 0 ? (
            <div className="quick-terms" aria-label="Przykładowe pojęcia">
              {quickTerms.map((term) => (
                <button
                  disabled={isChatBusy}
                  key={term}
                  onClick={() => setInput(term)}
                  type="button"
                >
                  {term}
                </button>
              ))}
            </div>
          ) : null}
          {attachedImage ? (
            <div className="attachment-preview">
              <img alt={attachedImage.name} src={attachedImage.filePart.url} />
              <div>
                <strong>📎 Screenshot - zadaj pytanie o ten obraz</strong>
                <span>{attachedImage.name}</span>
              </div>
              <button
                aria-label="Usuń obraz"
                disabled={isChatBusy}
                onClick={() => setAttachedImage(null)}
                type="button"
              >
                ×
              </button>
            </div>
          ) : null}
          {imageError ? <div className="attachment-error">{imageError}</div> : null}
          <input
            accept="image/*"
            className="file-input"
            onChange={handleFileInputChange}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label="Dodaj obraz"
            className="attach-button"
            disabled={isChatBusy}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            📎
          </button>
          <input
            aria-label="Wiadomość"
            disabled={isChatBusy}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            placeholder={inputPlaceholder}
            value={input}
          />
          <button disabled={isChatBusy || (!input.trim() && !attachedImage)} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
