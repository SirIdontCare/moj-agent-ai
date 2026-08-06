import ChatClient from "../chat-client";

const exampleQuestions = [
  "Pomóż mi zaplanować najważniejsze zadania na dziś",
  "Przeanalizuj ten pomysł i wskaż ryzyka",
  "Napisz profesjonalną odpowiedź na trudnego maila",
  "Wytłumacz mi złożony temat prostymi słowami",
];

export default function ChatPage() {
  return (
    <ChatClient
      api="/api/chat"
      description="Uniwersalny asystent do analizy, pisania, planowania i codziennej pracy."
      emptyMessage="Cześć! W czym mogę Ci dziś pomóc?"
      exampleQuestions={exampleQuestions}
      inputPlaceholder="Napisz wiadomość..."
      title="Agent AI"
    />
  );
}
