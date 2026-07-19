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
import { Plus, PenLine, Trash2 } from "lucide-react";
import {
  listOutputTopics,
  createOutputTopic,
  updateOutputTopic,
  deleteOutputTopic,
} from "@/app/actions/output";
import type { OutputTopic } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
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

  useEffect(() => {
    setResponse(active?.response ?? "");
  }, [active?.id, active?.response]);

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
    const { error } = await updateOutputTopic(active.id, { response });
    setSaving(false);
    if (error) {
      toast.error("保存に失敗しました");
      return;
    }
    setTopics((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, response } : t)),
    );
    toast.success("保存しました");
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { error, topic } = await createOutputTopic(newTitle.trim());
    setCreating(false);
    if (error || !topic) {
      toast.error("作成に失敗しました");
      return;
    }
    setTopics((prev) => [topic, ...prev]);
    setActiveId(topic.id);
    setShowNewModal(false);
    setNewTitle("");
  }

  async function handleDelete(id: string) {
    if (!confirm("このトピックを削除しますか？")) return;
    await deleteOutputTopic(id);
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) setActiveId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="w-full max-w-[980px]">
      <div className="mb-1.5 flex items-center justify-between">
        <div
          className="text-[12.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--color-accent)" }}
        >
          Output
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          トピックを追加
        </Button>
      </div>
      <h1 className="mb-[22px] text-[30px] font-bold text-foreground">
        Speak from your own words
      </h1>

      <div
        className="grid items-start gap-[22px]"
        style={{ gridTemplateColumns: "230px 1fr" }}
      >
        {/* 左カラム：トピック一覧 */}
        <div
          className="min-h-[500px] rounded-[20px] p-2"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {topics.map((t) => {
            const written = t.response.trim().length > 0;
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
            icon={<PenLine className="h-8 w-8" />}
            title="トピックがありません"
            description="「トピックを追加」から追加して、レッスン前に話す内容を書いてみましょう"
          />
        ) : (
          <div
            className="rounded-[20px] p-[26px_30px]"
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
              placeholder="トピックを入力..."
            />
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="自分の言葉で英語の回答を書いてみましょう..."
              className="min-h-[200px] w-full resize-y text-[15px] leading-relaxed"
              style={{ background: "var(--color-background)" }}
            />
            <div className="mt-3.5 flex items-center justify-between">
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
                  削除
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveResponse}
                  disabled={saving || response === active.response}
                >
                  {saving ? "保存中..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>トピックを追加</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例: What's a hobby you enjoy after work, and why?"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "作成中..." : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
