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
import { Plus, PenLine, Trash2, ExternalLink } from "lucide-react";
import {
  listOutputTopics,
  createOutputTopic,
  updateOutputTopic,
  deleteOutputTopic,
} from "@/app/actions/output";
import type { OutputTopic, OutputResponseStatus } from "@/lib/types";

// Claude でレビュー・添削してもらう用の常設チャット
const REVIEW_CHAT_URL = "https://claude.ai/chat/2bad3a13-dd33-4265-ad53-5192217de4ae";

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

const STATUS_OPTIONS: { value: OutputResponseStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
];

function StatusToggle({
  status,
  onChange,
}: {
  status: OutputResponseStatus;
  onChange: (next: OutputResponseStatus) => void;
}) {
  return (
    <div
      className="flex shrink-0 gap-0.5 rounded-full p-0.5"
      style={{ background: "var(--color-surface-subtle)" }}
    >
      {STATUS_OPTIONS.map((o) => {
        const isActive = status === o.value;
        const activeColor = o.value === "revised" ? "var(--color-success)" : "var(--color-text-primary)";
        const activeBg = o.value === "revised" ? "var(--color-success-subtle)" : "var(--color-surface)";
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
            style={{
              background: isActive ? activeBg : "transparent",
              color: isActive ? activeColor : "var(--color-text-secondary)",
              boxShadow: isActive ? "var(--shadow-md)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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

export default function OutputPage() {
  const [topics, setTopics] = useState<OutputTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [versionIdx, setVersionIdx] = useState(0);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

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
  const versions = active?.responses?.length ? active.responses : [""];
  const statuses = active ? statusesFor(active) : ["draft" as OutputResponseStatus];
  const currentStatus = statuses[versionIdx] ?? "draft";

  useEffect(() => {
    setVersionIdx(0);
  }, [active?.id]);

  useEffect(() => {
    setResponse(versions[versionIdx] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, versionIdx, active?.responses]);

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
    const nextResponses = [...versions];
    nextResponses[versionIdx] = response;
    const { error } = await updateOutputTopic(active.id, {
      responses: nextResponses,
      response: nextResponses[0] ?? "",
      response_statuses: statuses,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setTopics((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? { ...t, responses: nextResponses, response_statuses: statuses }
          : t,
      ),
    );
    toast.success("Saved");
  }

  function handleAddVersion() {
    if (!active) return;
    const nextResponses = [...versions, ""];
    const nextStatuses = [...statuses, "draft" as OutputResponseStatus];
    setTopics((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? { ...t, responses: nextResponses, response_statuses: nextStatuses }
          : t,
      ),
    );
    setVersionIdx(nextResponses.length - 1);
  }

  async function handleSetStatus(next: OutputResponseStatus) {
    if (!active) return;
    const nextStatuses = [...statuses];
    nextStatuses[versionIdx] = next;
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

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { error, topic } = await createOutputTopic(newTitle.trim());
    setCreating(false);
    if (error || !topic) {
      toast.error(error ? `Failed to create: ${error}` : "Failed to create");
      return;
    }
    setTopics((prev) => [topic, ...prev]);
    setActiveId(topic.id);
    setShowNewModal(false);
    setNewTitle("");
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
    <div className="flex h-full w-full min-h-0 flex-col">
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
            const written = (t.responses?.length ? t.responses : [t.response]).some(
              (r) => r.trim().length > 0,
            );
            const isActive = t.id === activeId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className="mb-0.5 w-full rounded-[12px] px-4 py-3.5 text-left transition-colors"
                style={{
                  background: isActive ? "var(--color-primary-soft)" : "transparent",
                }}
              >
                <p
                  className="mb-1 text-[14px] font-semibold leading-snug"
                  style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-primary)" }}
                >
                  {t.title}
                </p>
                <div className="text-[12px] text-muted-foreground">
                  {written ? "Written" : "Not started"} · {formatDate(t.created_at)}
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
            className="flex h-full flex-col rounded-[20px] p-[26px_30px]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <p className="mb-1.5 text-[12.5px] text-muted-foreground">
              {formatDate(active.created_at)}
            </p>
            <InlineEdit
              value={active.title}
              onChange={handleTitleChange}
              className="mb-4 w-full border-0 border-b border-dashed pb-3.5 text-[18px] font-bold text-foreground"
              inputClassName="border-0 border-b border-dashed pb-3.5 text-[18px] font-bold"
              placeholder="Enter a topic..."
            />
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {versions.map((_, i) => {
                const isActive = i === versionIdx;
                return (
                  <button
                    key={i}
                    onClick={() => setVersionIdx(i)}
                    className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
                    style={{
                      border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border-default)"}`,
                      background: isActive ? "var(--color-primary-soft)" : "var(--color-surface)",
                      color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                    }}
                  >
                    Version {i + 1}
                  </button>
                );
              })}
              <button
                onClick={handleAddVersion}
                className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-muted-foreground"
                style={{ border: "1px dashed var(--color-border-default)" }}
              >
                + Add version
              </button>
            </div>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your response in your own words..."
              className="min-h-0 w-full flex-1 resize-none text-[15px] leading-relaxed"
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
                  disabled={saving || response === (versions[versionIdx] ?? "")}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
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
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "Creating..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
