import ChatClient from "../chat-client";

const exampleQuestions = [
  "Czy na B2B lepszy będzie ryczałt czy skala?",
  "Jakie koszty mogę wrzucić w działalność usługową?",
  "Kiedy muszę zarejestrować się do VAT?",
  "Jak rozliczyć fakturę za narzędzia online z UE?",
];

export default function ChatPage() {
  return (
    <ChatClient
      api="/api/chat"
      description="Ekspert od podatków B2B. Zapytaj mnie o PIT, VAT, ryczałt, koszty firmowe i wybór formy opodatkowania."
      emptyMessage="Cześć, jestem Marta. Zapytaj mnie o podatki."
      exampleQuestions={exampleQuestions}
      inputPlaceholder="Napisz wiadomość..."
      title="Marta — doradczyni podatkowa 💰"
    />
  );
}
