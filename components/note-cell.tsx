"use client";

import { useState } from "react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  toast,
} from "@takaki/go-design-system";
import { MessageSquare, MessageSquareText, Check } from "lucide-react";
import { setItemNote } from "@/app/actions/practice";

type Kind = "grammar" | "expression" | "word";

/**
 * 理解のための自由メモ（note）の表示＋編集。
 * ライブラリの一覧で使い、popup から入力・編集・削除できる。
 */
export function NoteCell({
  kind,
  id,
  value,
  onChanged,
}: {
  kind: Kind;
  id: string;
  value: string | null;
  onChanged: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function commit(next: string) {
    const trimmed = next.trim();
    const normalized = trimmed || null;
    if (normalized === (value ?? null)) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await setItemNote(kind, id, trimmed);
      onChanged(normalized);
      setOpen(false);
    } catch {
      toast.error("メモの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={value ? "メモを編集" : "メモを追加"}
          title={value ?? "メモを追加"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
        >
          {value ? (
            <MessageSquareText className="h-4 w-4 text-[color:var(--color-primary)]" />
          ) : (
            <MessageSquare className="h-4 w-4 text-muted-foreground/40" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2.5 p-3">
        <div className="text-xs font-semibold text-foreground">メモ</div>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="理解のためのメモ…（語順・ニュアンス・覚え方など）"
          className="resize-y text-sm"
        />
        <div className="flex items-center justify-between pt-0.5">
          {value ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => commit("")}
              disabled={saving}
            >
              削除
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => commit(draft)}
            disabled={saving}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            保存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
