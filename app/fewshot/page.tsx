import ChatClient from "../chat-client";

const quickTerms = [
  "Sztuczna inteligencja",
  "Agent AI",
  "Prompt",
  "Halucynacja AI",
  "RAG",
  "API",
];

export default function FewShotPage() {
  return (
    <ChatClient
      api="/api/fewshot"
      description="Wyjaśniam trudne pojęcia prostym językiem"
      emptyMessage="Wpisz pojęcie, a dostaniesz krótką definicję z analogią i przykładem."
      exampleQuestions={[]}
      inputPlaceholder="Wpisz pojęcie do wyjaśnienia..."
      quickTerms={quickTerms}
      showModeSwitcher={false}
      title="📚 Słownik AI"
    />
  );
}
