"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Button,
  Textarea,
  InlineEdit,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  EmptyState,
  toast,
} from "@takaki/go-design-system";
import { Plus, PenLine, Trash2, ExternalLink, Mic, Check, Sparkles } from "lucide-react";
import {
  listOutputTopics,
  createOutputTopic,
  updateOutputTopic,
  deleteOutputTopic,
  generateOutputTopics,
} from "@/app/actions/output";
import type { OutputTopic, OutputResponseStatus } from "@/lib/types";

// Claude でレビュー・添削してもらう用の Fluent_Output プロジェクト（新規チャットから開始）
const REVIEW_CHAT_URL = "https://claude.ai/project/019f97a4-3a56-72ff-8620-6864963fe7d5";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// responses[i] に対応する status。未設定分は "draft" 扱い
function statusesFor(topic: OutputTopic): OutputResponseStatus[] {
  const versions = topic.responses?.length ? topic.responses : [""];
  return versions.map((_, i) => topic.response_statuses?.[i] ?? "draft");
}

function StatusTag({
  status,
  onChange,
}: {
  status: OutputResponseStatus;
  onChange: (next: OutputResponseStatus) => void;
}) {
  const isRevised = status === "revised";
  return (
    <button
      onClick={() => onChange(isRevised ? "draft" : "revised")}
      title="Click to toggle Draft / Revised"
      className="shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
      style={{
        background: isRevised ? "var(--color-success-subtle)" : "var(--color-surface-subtle)",
        color: isRevised ? "var(--color-success)" : "var(--color-text-secondary)",
      }}
    >
      {isRevised ? "Revised" : "Draft"}
    </button>
  );
}

function StatusDot({ status }: { status: OutputResponseStatus }) {
  return (
    <span
      className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{
        background: status === "revised" ? "var(--color-success)" : "var(--color-warning)",
      }}
    />
  );
}

const READ_ALOUD_GOAL = 5;

// responses[i] に対応する音読回数。未設定分は 0 扱い
function readCountsFor(topic: OutputTopic): number[] {
  const versions = topic.responses?.length ? topic.responses : [""];
  return versions.map((_, i) => topic.read_aloud_counts?.[i] ?? 0);
}

// トピック一覧用: 書かれているバージョン全体の音読進捗をまとめて1つの表示にする
function readAloudSummary(
  topic: OutputTopic,
): { label: string; done: boolean } | null {
  const versionTexts = topic.responses?.length ? topic.responses : [topic.response];
  const counts = readCountsFor(topic);
  const writtenIdxs = versionTexts
    .map((_, i) => i)
    .filter((i) => (versionTexts[i] ?? "").trim().length > 0);
  if (writtenIdxs.length === 0) return null;

  const goal = writtenIdxs.length * READ_ALOUD_GOAL;
  const total = writtenIdxs.reduce(
    (sum, i) => sum + Math.min(counts[i] ?? 0, READ_ALOUD_GOAL),
    0,
  );
  const done = total >= goal;
  return { label: `${total}/${goal}`, done };
}

function ReadAloudButton({
  count,
  onIncrement,
}: {
  count: number;
  onIncrement: () => void;
}) {
  const done = count >= READ_ALOUD_GOAL;
  return (
    <button
      onClick={onIncrement}
      disabled={done}
      title={done ? `音読${READ_ALOUD_GOAL}回、完了！` : "音読したらタップ"}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-default"
      style={{
        background: done ? "var(--color-success-subtle)" : "var(--color-surface-subtle)",
        color: done ? "var(--color-success)" : "var(--color-text-secondary)",
      }}
    >
      {done ? <Check className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      Read aloud {count}/{READ_ALOUD_GOAL}
    </button>
  );
}

export default function OutputPage() {
  const [topics, setTopics] = useState<OutputTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [addingSuggestions, setAddingSuggestions] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listOutputTopics();
    setTopics(data);
    setActiveId((prev) => prev ?? data[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () => topics.find((t) => t.id === activeId) ?? null,
    [topics, activeId],
  );
  const savedResponse = active?.responses?.[0] ?? active?.response ?? "";
  const statuses = active ? statusesFor(active) : ["draft" as OutputResponseStatus];
  const currentStatus = statuses[0] ?? "draft";
  const readCounts = active ? readCountsFor(active) : [0];
  const currentReadCount = readCounts[0] ?? 0;

  useEffect(() => {
    setResponse(savedResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.responses, active?.response]);

  async function handleTitleChange(next: string) {
    if (!active || !next.trim() || next === active.title) return;
    setTopics((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, title: next } : t)),
    );
    await updateOutputTopic(active.id, { title: next });
  }

  async function handleSaveResponse() {
    if (!active) return;
    setSaving(true);
    const { error } = await updateOutputTopic(active.id, {
      responses: [response],
      response,
      response_statuses: statuses,
      read_aloud_counts: readCounts,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setTopics((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? {
              ...t,
              responses: [response],
              response,
              response_statuses: statuses,
              read_aloud_counts: readCounts,
            }
          : t,
      ),
    );
    toast.success("Saved");
  }

  async function handleSetStatus(next: OutputResponseStatus) {
    if (!active) return;
    const nextStatuses = [next];
    setTopics((prev) =>
      prev.map((t) =>
        t.id === active.id ? { ...t, response_statuses: nextStatuses } : t,
      ),
    );
    const { error } = await updateOutputTopic(active.id, {
      response_statuses: nextStatuses,
    });
    if (error) toast.error("Failed to update status");
  }

  async function handleReadAloud() {
    if (!active || currentReadCount >= READ_ALOUD_GOAL) return;
    const nextReadCounts = [currentReadCount + 1];
    setTopics((prev) =>
      prev.map((t) =>
        t.id === active.id ? { ...t, read_aloud_counts: nextReadCounts } : t,
      ),
    );
    const { error } = await updateOutputTopic(active.id, {
      read_aloud_counts: nextReadCounts,
    });
    if (error) toast.error("Failed to save read-aloud count");
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    const { error, topic } = await createOutputTopic(title);
    setCreating(false);
    if (error || !topic) {
      toast.error(error ? `Failed to create: ${error}` : "Failed to create");
      return;
    }
    setTopics((prev) => [topic, ...prev]);
    setActiveId(topic.id);
    closeNewModal();
  }

  function closeNewModal() {
    setShowNewModal(false);
    setNewTitle("");
    setSuggestions([]);
    setSelectedSuggestions(new Set());
  }

  async function handleGenerateTopics() {
    setGeneratingTopics(true);
    const { error, topics } = await generateOutputTopics();
    setGeneratingTopics(false);
    if (error || !topics) {
      toast.error(error ?? "Failed to generate topics");
      return;
    }
    setSuggestions(topics);
    setSelectedSuggestions(new Set(topics.map((_, i) => i)));
  }

  function toggleSuggestion(i: number) {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function handleAddSelectedSuggestions() {
    const titles = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (titles.length === 0) return;
    setAddingSuggestions(true);
    const results = await Promise.all(titles.map((t) => createOutputTopic(t)));
    setAddingSuggestions(false);

    const created = results
      .map((r) => r.topic)
      .filter((t): t is OutputTopic => !!t);
    if (created.length > 0) {
      setTopics((prev) => [...created, ...prev]);
      setActiveId(created[0].id);
      toast.success(`Added ${created.length} topic${created.length === 1 ? "" : "s"}`);
    }
    const failedCount = titles.length - created.length;
    if (failedCount > 0) {
      toast.error(`Failed to add ${failedCount} topic${failedCount === 1 ? "" : "s"}`);
    }
    closeNewModal();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this topic?")) return;
    await deleteOutputTopic(id);
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) setActiveId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="flex w-full min-h-0 flex-col"
      style={{ height: "calc(100svh - 2rem)" }}
    >
      <div
        className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-accent)" }}
      >
        Output
      </div>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-bold text-foreground">
          Speak from your own words
        </h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" asChild>
            <a href={REVIEW_CHAT_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Review chat
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add topic
          </Button>
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 items-start gap-[22px]"
        style={{ gridTemplateColumns: "280px 1fr" }}
      >
        {/* 左カラム：トピック一覧 */}
        <div
          className="h-full overflow-y-auto rounded-[20px] p-2"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {topics.map((t) => {
            const versionTexts = t.responses?.length ? t.responses : [t.response];
            const written = versionTexts.some((r) => r.trim().length > 0);
            const needsReview = statusesFor(t).some(
              (s, i) => s === "draft" && (versionTexts[i] ?? "").trim().length > 0,
            );
            const readAloud = readAloudSummary(t);
            const isActive = t.id === activeId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className="mb-0.5 w-full rounded-[12px] px-4 py-2.5 text-left transition-colors"
                style={{
                  background: isActive ? "var(--color-primary-soft)" : "transparent",
                }}
              >
                <p
                  className="mb-1 truncate text-[14px] font-semibold leading-snug"
                  style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-primary)" }}
                >
                  {t.title}
                </p>
                <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] text-muted-foreground">
                  {written && <StatusDot status={needsReview ? "draft" : "revised"} />}
                  {written ? formatDate(t.updated_at) : `Not started · ${formatDate(t.updated_at)}`}
                  {readAloud && (
                    <span
                      className="flex items-center gap-1 font-semibold"
                      style={{ color: readAloud.done ? "var(--color-success)" : "var(--color-text-secondary)" }}
                    >
                      ·
                      {readAloud.done ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Mic className="h-3 w-3" />
                      )}
                      {readAloud.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 右カラム：エディタ */}
        {!active ? (
          <EmptyState
            className="h-full"
            icon={<PenLine className="h-8 w-8" />}
            title="No topics yet"
            description='Add one with "Add topic" and start writing what you want to say before your lesson.'
          />
        ) : (
          <div
            className="flex h-full flex-col overflow-y-auto rounded-[20px] p-[26px_30px]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-dashed pb-3.5">
              <InlineEdit
                value={active.title}
                onChange={handleTitleChange}
                className="w-full flex-1 border-0 text-[18px] font-bold text-foreground"
                inputClassName="border-0 text-[18px] font-bold"
                placeholder="Enter a topic..."
              />
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <ReadAloudButton count={currentReadCount} onIncrement={handleReadAloud} />
                <StatusTag status={currentStatus} onChange={handleSetStatus} />
              </div>
            </div>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your response in your own words..."
              // flex-1(flex-basis:0)だとflexが毎回0基準で高さを再計算し直すため、
              // textareaのネイティブresize(縦ドラッグ)と競合してドラッグしても伸びない。
              // flex-basis:autoのflex-auto(=flex-1 1 auto)なら、リサイズ後の高さ自体が
              // 次のbasisとして扱われるため、初期表示で余白を埋めつつresizeも機能する
              className="min-h-[420px] w-full flex-auto resize-y text-[18px] leading-relaxed"
              style={{ background: "var(--color-background)" }}
            />
            <div className="mt-3.5 flex shrink-0 items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground tabular-nums">
                {wordCount(response)} words
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(active.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveResponse}
                  disabled={saving || response === savedResponse}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={showNewModal}
        onOpenChange={(open) => {
          if (open) setShowNewModal(true);
          else closeNewModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add topic</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. What's a hobby you enjoy after work, and why?"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />

          {suggestions.length === 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit text-muted-foreground"
              onClick={handleGenerateTopics}
              disabled={generatingTopics}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {generatingTopics ? "Generating ideas..." : "Generate ideas with AI"}
            </Button>
          ) : (
            <div
              className="rounded-[14px]"
              style={{ border: "1px solid var(--color-border-default)" }}
            >
              <div
                className="flex items-center justify-between px-3.5 py-2.5"
                style={{ borderBottom: "1px solid var(--color-border-default)" }}
              >
                <span className="text-[12px] font-semibold text-muted-foreground">
                  {selectedSuggestions.size} of {suggestions.length} selected
                </span>
                <button
                  onClick={handleGenerateTopics}
                  disabled={generatingTopics}
                  className="flex items-center gap-1 text-[12px] font-semibold disabled:opacity-50"
                  style={{ color: "var(--color-primary)" }}
                >
                  <Sparkles className="h-3 w-3" />
                  {generatingTopics ? "Generating..." : "Regenerate"}
                </button>
              </div>
              <div className="max-h-[260px] overflow-y-auto p-1.5">
                {suggestions.map((s, i) => {
                  const selected = selectedSuggestions.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleSuggestion(i)}
                      className="flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors"
                      style={{
                        background: selected ? "var(--color-primary-soft)" : "transparent",
                      }}
                    >
                      <span
                        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                        style={{
                          border: `2px solid ${selected ? "var(--color-primary)" : "var(--color-border-default)"}`,
                          background: selected ? "var(--color-primary)" : "transparent",
                        }}
                      >
                        {selected && (
                          <Check className="h-3 w-3" strokeWidth={3} style={{ color: "var(--color-surface)" }} />
                        )}
                      </span>
                      <span
                        className="text-[13.5px] leading-snug"
                        style={{ color: selected ? "var(--color-primary)" : "var(--color-text-primary)" }}
                      >
                        {s}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            {suggestions.length > 0 ? (
              <Button
                onClick={handleAddSelectedSuggestions}
                disabled={addingSuggestions || selectedSuggestions.size === 0}
              >
                {addingSuggestions
                  ? "Adding..."
                  : `Add ${selectedSuggestions.size} topic${selectedSuggestions.size === 1 ? "" : "s"}`}
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                {creating ? "Creating..." : "Add"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
