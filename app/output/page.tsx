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
  cn,
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
    <div className="flex gap-6 h-[calc(100vh-6rem)] max-w-5xl">
      {/* 左カラム：トピック一覧 */}
      <div className="w-[230px] shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[16px] font-bold text-foreground">アウトプット</h1>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setShowNewModal(true)}
            aria-label="トピックを追加"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {topics.map((t) => {
            const written = t.response.trim().length > 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "w-full text-left rounded-[12px] px-3 py-2.5 transition-colors",
                  t.id === activeId
                    ? "bg-[var(--color-primary-soft)]"
                    : "hover:bg-[var(--color-surface-subtle)]",
                )}
              >
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {t.title}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{written ? "Written" : "Not started"}</span>
                  <span>·</span>
                  <span>{formatDate(t.created_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右カラム：エディタ */}
      <div className="flex-1 min-w-0">
        {!active ? (
          <EmptyState
            icon={<PenLine className="h-8 w-8" />}
            title="トピックがありません"
            description="「+」からトピックを追加して、レッスン前に話す内容を書いてみましょう"
          />
        ) : (
          <div
            className="rounded-[20px] p-9 h-full flex flex-col"
            style={{
              background: "var(--color-surface)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <p className="text-xs text-muted-foreground mb-2">
              {formatDate(active.created_at)}
            </p>
            <InlineEdit
              value={active.title}
              onChange={handleTitleChange}
              className="text-[24px] font-bold text-foreground mb-5"
              placeholder="トピックを入力..."
            />
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="自分の言葉で英語の回答を書いてみましょう..."
              className="flex-1 min-h-[200px] resize-none text-[15px] leading-relaxed"
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground tabular-nums">
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
