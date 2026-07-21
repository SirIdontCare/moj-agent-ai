/**
 * Dzieli tekst na fragmenty wygodne do zamiany na embeddingi.
 * Granice zdań i wierszy są preferowane, a końcówka poprzedniego fragmentu
 * trafia do następnego jako krótki kontekst.
 */
export function splitIntoChunks(text: string, chunkSize = 500, overlap = 50): string[] {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!normalizedText) {
    return [];
  }

  if (!Number.isFinite(chunkSize) || chunkSize < 1) {
    throw new Error("Rozmiar fragmentu musi być dodatnią liczbą.");
  }

  const safeOverlap = Math.max(0, Math.min(Math.floor(overlap), Math.floor(chunkSize / 2)));
  const maxUnitLength = Math.max(1, Math.floor(chunkSize - safeOverlap));
  const sentences = normalizedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .flatMap((sentence) => splitLongText(sentence, maxUnitLength));

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

    if (candidate.length <= chunkSize || !currentChunk) {
      currentChunk = candidate;
      continue;
    }

    chunks.push(currentChunk);
    const context = safeOverlap ? currentChunk.slice(-safeOverlap).trim() : "";
    currentChunk = context ? `${context} ${sentence}` : sentence;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function splitLongText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const breakAt = remaining.lastIndexOf(" ", maxLength);
    const splitAt = breakAt > 0 ? breakAt : maxLength;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}
