import { generateEmbedding } from "@/lib/embeddings";
import { supabase } from "@/lib/supabase";

export type KnowledgeMetadata = Record<string, unknown>;

export type KnowledgeSearchItem = {
  id: string;
  title: string;
  content: string;
  similarity: number;
  metadata: KnowledgeMetadata;
  added_at: string | null;
};

export type KnowledgeSearchResponse = {
  results: KnowledgeSearchItem[];
  total_found: number;
  source_documents: string[];
  message?: string;
};

type MatchDocumentRow = {
  id: string | null;
  title: string | null;
  content: string | null;
  similarity: number | null;
  metadata: unknown;
};

type DocumentDateRow = {
  id: string;
  created_at: string | null;
};

function normalizeMetadata(value: unknown): KnowledgeMetadata {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? (value as KnowledgeMetadata)
    : {};
}

function toDateOnly(value: unknown) {
  return typeof value === "string" && value ? value.slice(0, 10) : null;
}

function getRequiredNamedTerms(query: string) {
  const ignoredTerms = new Set([
    "czy",
    "cena",
    "co",
    "dlaczego",
    "faq",
    "firma",
    "gdzie",
    "ile",
    "jak",
    "jaka",
    "jaką",
    "jaki",
    "jakie",
    "kiedy",
    "koszt",
    "która",
    "które",
    "który",
    "mam",
    "może",
    "oferta",
    "pakiet",
    "regulamin",
  ]);

  return Array.from(
    new Set(
      query
        .match(/\b[A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9-]{2,}\b/g)
        ?.map((term) => term.toLocaleLowerCase("pl-PL"))
        .filter((term) => !ignoredTerms.has(term)) ?? [],
    ),
  );
}

const LEXICAL_STOP_WORDS = new Set([
  "aby",
  "albo",
  "czy",
  "dla",
  "gdzie",
  "ile",
  "jak",
  "jaka",
  "jakie",
  "jaki",
  "jest",
  "ktora",
  "ktore",
  "ktory",
  "mam",
  "mozna",
  "oferta",
  "oraz",
  "prosze",
  "sie",
  "ten",
  "tym",
  "zawiera",
]);

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl-PL");
}

function getLexicalTerms(value: string) {
  return Array.from(
    new Set(
      normalizeSearchText(value)
        .match(/[a-z0-9-]{3,}/g)
        ?.filter((term) => !LEXICAL_STOP_WORDS.has(term)) ?? [],
    ),
  );
}

function hasLexicalTerm(searchableText: string, term: string) {
  if (term.length <= 4) {
    return searchableText.split(/[^a-z0-9-]+/).includes(term);
  }

  const stem = term.slice(0, Math.min(5, term.length));
  return searchableText
    .split(/[^a-z0-9-]+/)
    .some((word) => word.startsWith(stem));
}

function filterByLexicalRelevance(rows: MatchDocumentRow[], query: string) {
  const queryTerms = getLexicalTerms(query);

  if (queryTerms.length < 2 || rows.length < 2) {
    return rows;
  }

  const scoredRows = rows.map((row) => {
    const searchableText = normalizeSearchText(`${row.title ?? ""} ${row.content ?? ""}`);
    const matches = queryTerms.filter((term) => hasLexicalTerm(searchableText, term)).length;
    return { row, matches };
  });
  const bestMatchCount = Math.max(...scoredRows.map(({ matches }) => matches));

  // Gdy najlepszy fragment potwierdza co najmniej dwa istotne pojęcia,
  // odrzucamy wyniki oparte wyłącznie na luźnym podobieństwie tematycznym.
  if (bestMatchCount < 2) {
    return rows;
  }

  return scoredRows
    .filter(({ matches }) => matches === bestMatchCount)
    .map(({ row }) => row);
}

export async function searchKnowledge(
  query: string,
  options: { matchThreshold?: number; matchCount?: number } = {},
): Promise<KnowledgeSearchResponse> {
  const matchThreshold = options.matchThreshold ?? 0.5;
  const matchCount = options.matchCount ?? 5;
  const embedding = await generateEmbedding(query);
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(error.message);
  }

  const requiredNamedTerms = getRequiredNamedTerms(query);
  const thresholdRows = ((data ?? []) as MatchDocumentRow[]).filter((row) => {
    if (Number(row.similarity ?? 0) < matchThreshold) {
      return false;
    }

    if (!requiredNamedTerms.length) {
      return true;
    }

    const searchableText = `${row.title ?? ""} ${row.content ?? ""}`.toLocaleLowerCase("pl-PL");
    return requiredNamedTerms.every((term) => searchableText.includes(term));
  });
  const rows = filterByLexicalRelevance(thresholdRows, query);
  const ids = rows.flatMap((row) => (row.id ? [row.id] : []));
  const createdAtById = new Map<string, string | null>();

  if (ids.length) {
    const { data: dateRows } = await supabase
      .from("documents")
      .select("id, created_at")
      .in("id", ids);

    for (const row of (dateRows ?? []) as DocumentDateRow[]) {
      createdAtById.set(row.id, row.created_at);
    }
  }

  const results = rows.map((row) => {
    const metadata = normalizeMetadata(row.metadata);
    const title = row.title?.trim() || "Bez tytułu";

    return {
      id: row.id ?? `${title}-${resultsSafeIndex(row.content)}`,
      title,
      content: row.content ?? "",
      similarity: Number(row.similarity ?? 0),
      metadata,
      added_at:
        toDateOnly(createdAtById.get(row.id ?? "")) ?? toDateOnly(metadata.added_at),
    };
  });
  const sourceDocuments = Array.from(new Set(results.map((result) => result.title)));

  if (!results.length) {
    return {
      results: [],
      total_found: 0,
      source_documents: [],
      message:
        "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio.",
    };
  }

  return {
    results,
    total_found: results.length,
    source_documents: sourceDocuments,
  };
}

function resultsSafeIndex(content: string | null) {
  let hash = 0;

  for (const character of content ?? "") {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash.toString(16);
}
