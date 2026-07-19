"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { revalidatePath } from "next/cache";
import type { OutputTopic } from "@/lib/types";

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
    .insert({ user_id: user.id, language, title, response: "", responses: [""] })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/output");
  revalidatePath("/");
  return { topic: data as OutputTopic };
}

export async function updateOutputTopic(
  id: string,
  patch: { title?: string; response?: string; responses?: string[] },
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
