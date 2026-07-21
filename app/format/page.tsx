import ChatClient from "../chat-client";

const formatCommands = [
  "/tabela języki programowania 2026",
  "/porownanie ChatGPT vs Claude",
  "/lista 5 kroków do pierwszego agenta AI",
  "/faq sztuczna inteligencja dla początkujących",
  "/email podziękowanie za udaną rekrutację",
];

export default function FormatPage() {
  return (
    <ChatClient
      api="/api/format"
      description="Agent odpowiada w tabeli, liście, porównaniu — na żądanie"
      emptyMessage="Wybierz komendę, edytuj ją w polu wiadomości i wyślij."
      exampleQuestions={[]}
      inputPlaceholder="Wpisz komendę, np. /tabela modele AI"
      quickTerms={formatCommands}
      renderMarkdown
      showModeSwitcher={false}
      title="📐 Formatowanie"
    />
  );
}
