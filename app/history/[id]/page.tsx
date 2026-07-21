import ConversationPreview from "../conversation-preview";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ConversationPreview conversationId={id} />;
}
