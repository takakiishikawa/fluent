"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { revalidatePath } from "next/cache";
import type { OutputTopic, OutputResponseStatus } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOPIC_GEN_SYSTEM_PROMPT = `You generate short speaking-practice topics/questions for a Japanese adult learner preparing for a 1-on-1 online English conversation lesson (e.g. Native Camp).

Rules:
- Each topic is a short, natural question or prompt a tutor might ask to start a conversation (e.g. "What did your father do for a living?", "How many brothers and sisters do you have?").
- Personal, everyday topics — family, hobbies, work, travel, opinions, daily routines. Nothing academic, exam-like, or overly abstract.
- Do NOT repeat or closely rephrase anything in EXISTING_TOPICS.
- Return exactly 5 distinct topics.

Return ONLY via the tool.`;

const TOPIC_GEN_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    topics: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Exactly 5 short speaking-practice topic prompts.",
    },
  },
  required: ["topics"],
};

export async function generateOutputTopics(): Promise<{
  error?: string;
  topics?: string[];
}> {
  const supabase = await createClient();
  const language = await getCurrentLanguage();
  const { data: existing } = await supabase
    .from("output_topics")
    .select("title")
    .eq("language", language);
  const existingTitles = (existing ?? []).map((t) => t.title as string);

  const userMessage = `EXISTING_TOPICS:\n${
    existingTitles.length
      ? existingTitles.map((t) => `- ${t}`).join("\n")
      : "(none yet)"
  }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: TOPIC_GEN_SYSTEM_PROMPT,
      tools: [
        {
          name: "save_topics",
          description: "Save the 5 generated speaking-practice topics.",
          input_schema: TOPIC_GEN_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "save_topics" },
      messages: [{ role: "user", content: userMessage }],
    });
    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { error: "AI response did not include tool_use" };
    }
    const { topics } = toolUse.input as { topics: string[] };
    return { topics };
  } catch (err) {
    console.error("[generateOutputTopics] failed:", err);
    return { error: "Failed to generate topics" };
  }
}

export async function listOutputTopics(): Promise<OutputTopic[]> {
  const supabase = await createClient();
  const language = await getCurrentLanguage();
  const { data } = await supabase
    .from("output_topics")
    .select("*")
    .eq("language", language)
    .order("created_at", { ascending: false });
  return (data ?? []) as OutputTopic[];
}

export async function createOutputTopic(
  title: string,
): Promise<{ error?: string; topic?: OutputTopic }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };
  const language = await getCurrentLanguage();

  const { data, error } = await supabase
    .from("output_topics")
    .insert({
      user_id: user.id,
      language,
      title,
      response: "",
      responses: [""],
      response_statuses: ["draft"],
      read_aloud_counts: [0],
    })
    .select()
    .single();

  if (error) {
    console.error("[createOutputTopic] failed:", error.message);
    return { error: error.message };
  }
  revalidatePath("/output");
  revalidatePath("/");
  return { topic: data as OutputTopic };
}

export async function updateOutputTopic(
  id: string,
  patch: {
    title?: string;
    response?: string;
    responses?: string[];
    response_statuses?: OutputResponseStatus[];
    read_aloud_counts?: number[];
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("output_topics")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/output");
  revalidatePath("/");
  return {};
}

export async function deleteOutputTopic(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("output_topics").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/output");
  revalidatePath("/");
  return {};
}
