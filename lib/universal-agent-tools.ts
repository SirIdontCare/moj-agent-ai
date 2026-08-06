import type { SupabaseClient } from "@supabase/supabase-js";
import { tool, zodSchema } from "ai";
import { z } from "zod/v4";
import {
  getExchangeRateTool,
  getHolidaysTool,
  getWeatherTool,
  searchWikipediaTool,
} from "@/app/lib/tools";
import {
  generateMorningBriefing,
  getBriefing,
  listBriefings,
  saveMorningBriefing,
} from "@/lib/morning-briefing";

type StoredNote = {
  title: string;
  content: string;
  createdAt: string;
};

type ProfilePreferences = Record<string, unknown>;

function normalizeNotes(preferences: ProfilePreferences | null): StoredNote[] {
  const value = preferences?.agent_notes;

  if (!Array.isArray(value)) return [];

  return value
    .filter((note): note is StoredNote =>
      typeof note === "object" &&
      note !== null &&
      "title" in note &&
      typeof note.title === "string" &&
      "content" in note &&
      typeof note.content === "string" &&
      "createdAt" in note &&
      typeof note.createdAt === "string",
    )
    .slice(-50);
}

async function getPreferences(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data?.preferences ?? {}) as ProfilePreferences;
}

export function createUniversalAgentTools(supabase: SupabaseClient, userId: string) {
  const saveAgentNote = tool({
    description:
      "Zapisuje prywatną notatkę użytkownika na później. Używaj tylko gdy użytkownik wyraźnie prosi, aby coś zapisać lub zapamiętać jako notatkę.",
    inputSchema: zodSchema(
      z.object({
        title: z.string().trim().min(1).max(200).describe("Krótki tytuł notatki"),
        content: z.string().trim().min(1).max(10_000).describe("Treść notatki"),
      }),
    ),
    execute: async ({ title, content }) => {
      try {
        const preferences = await getPreferences(supabase, userId);
        const notes = normalizeNotes(preferences);
        const note = { title, content, createdAt: new Date().toISOString() };
        const { error } = await supabase
          .from("user_profiles")
          .upsert(
            { id: userId, preferences: { ...preferences, agent_notes: [...notes, note].slice(-50) } },
            { onConflict: "id" },
          );

        if (error) throw error;
        return { saved: true, note };
      } catch (error) {
        return { saved: false, error: error instanceof Error ? error.message : "Nie udało się zapisać notatki." };
      }
    },
  });

  const getAgentNotes = tool({
    description:
      "Pobiera prywatne notatki zapisane wcześniej przez użytkownika. Używaj, gdy pyta o zapisane ustalenia, pomysły albo notatki.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        return { notes: normalizeNotes(await getPreferences(supabase, userId)) };
      } catch (error) {
        return { notes: [], error: error instanceof Error ? error.message : "Nie udało się pobrać notatek." };
      }
    },
  });

  const saveReport = tool({
    description:
      "Zapisuje gotowy raport użytkownika w jego bibliotece. Wywołuj dopiero, gdy użytkownik wyraźnie poprosi o zapisanie raportu.",
    inputSchema: zodSchema(
      z.object({
        topic: z.string().trim().min(1).max(1000).describe("Temat raportu"),
        content: z.string().trim().min(1).max(200_000).describe("Pełna treść raportu w Markdown"),
        sources: z.array(z.object({
          title: z.string().trim().max(500),
          url: z.string().url(),
        })).max(50).default([]),
      }),
    ),
    execute: async ({ topic, content, sources }) => {
      const heading = content.match(/^#\s+(?:📊\s*)?Raport:\s*(.+)$/im)?.[1]?.trim();
      const { data, error } = await supabase
        .from("reports")
        .insert({
          user_id: userId,
          topic,
          title: (heading || topic).slice(0, 300),
          content,
          sources,
          word_count: content.split(/\s+/).filter(Boolean).length,
        })
        .select("id, created_at")
        .single();

      if (error) return { saved: false, error: error.message };
      return { saved: true, reportId: data.id, createdAt: data.created_at };
    },
  });

  const listReports = tool({
    description:
      "Wyświetla ostatnie raporty zapisane przez użytkownika. Używaj, gdy pyta o swoją bibliotekę raportów.",
    inputSchema: zodSchema(z.object({ limit: z.number().int().min(1).max(20).default(10) })),
    execute: async ({ limit }) => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, topic, title, word_count, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return { reports: [], error: error.message };
      return { reports: data ?? [] };
    },
  });

  const getReport = tool({
    description: "Pobiera pełną treść konkretnego zapisanego raportu użytkownika.",
    inputSchema: zodSchema(z.object({ reportId: z.string().uuid() })),
    execute: async ({ reportId }) => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, topic, title, content, sources, word_count, created_at, updated_at")
        .eq("user_id", userId)
        .eq("id", reportId)
        .maybeSingle();

      if (error) return { report: null, error: error.message };
      return { report: data ?? null };
    },
  });

  const createMorningBriefing = tool({
    description:
      "Generuje i zapisuje dzisiejszy briefing z pogodą, kursami, świętami i wiadomościami. Używaj, gdy użytkownik prosi o poranny lub dzienny briefing.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        const { content, date } = await generateMorningBriefing();
        const saved = await saveMorningBriefing(date, content);
        return { id: saved.id, date, content, createdAt: saved.created_at };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Nie udało się przygotować briefingu." };
      }
    },
  });

  const getRecentBriefings = tool({
    description: "Pobiera listę ostatnich zapisanych briefingów.",
    inputSchema: zodSchema(z.object({ limit: z.number().int().min(1).max(10).default(5) })),
    execute: async ({ limit }) => {
      try {
        return { briefings: await listBriefings(limit) };
      } catch (error) {
        return { briefings: [], error: error instanceof Error ? error.message : "Nie udało się pobrać briefingów." };
      }
    },
  });

  const getSavedBriefing = tool({
    description: "Pobiera pełną treść konkretnego briefingu.",
    inputSchema: zodSchema(z.object({ briefingId: z.string().uuid() })),
    execute: async ({ briefingId }) => {
      try {
        return { briefing: await getBriefing(briefingId) };
      } catch (error) {
        return { briefing: null, error: error instanceof Error ? error.message : "Nie udało się otworzyć briefingu." };
      }
    },
  });

  return {
    getWeather: getWeatherTool,
    getExchangeRate: getExchangeRateTool,
    getHolidays: getHolidaysTool,
    searchWikipedia: searchWikipediaTool,
    saveAgentNote,
    getAgentNotes,
    saveReport,
    listReports,
    getReport,
    createMorningBriefing,
    getRecentBriefings,
    getSavedBriefing,
  };
}
