import ChatClient from "../chat-client";

const exampleQuestions = [
  "Jakie są najnowsze wiadomości o sztucznej inteligencji?",
  "Ile kosztuje iPhone 16 Pro w Polsce?",
  "Kto wygrał ostatni mecz reprezentacji Polski?",
  "Jakie filmy są teraz w kinach?",
];

export default function SearchPage() {
  return (
    <ChatClient
      api="/api/chat"
      description="Przeszukuję prawdziwy internet i czytam strony"
      emptyMessage="Zapytaj o aktualne dane albo podaj URL strony do przeczytania."
      exampleQuestions={exampleQuestions}
      inputPlaceholder="Zapytaj o cokolwiek aktualnego..."
      renderMarkdown
      requestMode="search"
      showModeSwitcher={false}
      title="🌐 Agent z wyszukiwarką"
    />
  );
}
