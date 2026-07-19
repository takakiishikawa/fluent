"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  DatePicker,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@takaki/go-design-system";
import { ExternalLink, Trash2, Plus } from "lucide-react";
import { saveEfSetScore, deleteEfSetScore } from "@/app/actions/ef-set";

const EF_SET_URL = "https://www.efset.org/ja/4-skill/launch/";

export type EfSetScore = {
  id: string;
  tested_at: string;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
  cefr_level: string;
};

function toDateObj(str: string): Date {
  return new Date(str + "T00:00:00");
}
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fmtDate(str: string): string {
  const [y, m, d] = str.split("-");
  return `${y}/${m}/${d}`;
}
function overall(s: EfSetScore): number {
  return Math.round((s.reading + s.listening + s.writing + s.speaking) / 4);
}

const SKILL_FIELDS = [
  { key: "reading", label: "リーディング" },
  { key: "listening", label: "リスニング" },
  { key: "writing", label: "ライティング" },
  { key: "speaking", label: "スピーキング" },
] as const;

type SkillKey = (typeof SKILL_FIELDS)[number]["key"];

// ─── 入力ダイアログ ──────────────────────────────────────────────────────────

function EfSetDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [skills, setSkills] = useState<Record<SkillKey, string>>({
    reading: "",
    listening: "",
    writing: "",
    speaking: "",
  });
  const [cefr, setCefr] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave =
    SKILL_FIELDS.every((f) => skills[f.key].trim() !== "") &&
    cefr.trim() !== "";

  function reset() {
    setDate(today);
    setSkills({ reading: "", listening: "", writing: "", speaking: "" });
    setCefr("");
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const result = await saveEfSetScore({
      tested_at: date,
      reading: Number(skills.reading),
      listening: Number(skills.listening),
      writing: Number(skills.writing),
      speaking: Number(skills.speaking),
      cefr_level: cefr.trim(),
    });
    setSaving(false);
    if (result?.error) {
      toast.error("保存に失敗しました");
      return;
    }
    toast.success("EF SET スコアを記録しました");
    reset();
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>EF SET スコアを記録</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">受験日</label>
            <DatePicker
              value={toDateObj(date)}
              onChange={(d) => {
                if (d) setDate(toDateStr(d));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SKILL_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-[13px] font-medium">{f.label}</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  placeholder="0–100"
                  value={skills[f.key]}
                  onChange={(e) =>
                    setSkills((s) => ({ ...s, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">CEFR レベル</label>
            <Input
              placeholder="例: B1, B1+"
              value={cefr}
              onChange={(e) => setCefr(e.target.value)}
            />
          </div>
          <FormActions>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? "記録中…" : "記録する"}
            </Button>
          </FormActions>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── EF SET カード ───────────────────────────────────────────────────────────

export function EfSetSection({ scores }: { scores: EfSetScore[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const latest = scores[0];

  async function handleDelete(id: string) {
    await deleteEfSetScore(id);
    router.refresh();
  }

  return (
    <div className="rounded-[20px] border border-[var(--color-border-default)] bg-card">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            EF SET スコア
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={EF_SET_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              公式テスト
            </a>
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            記録する
          </Button>
        </div>
      </div>

      {!latest ? (
        <div className="flex h-[120px] items-center justify-center text-[13px] text-muted-foreground">
          まだ記録がありません
        </div>
      ) : (
        <div className="grid gap-0 md:grid-cols-[210px_1fr]">
          {/* 最新スコア */}
          <div className="border-b border-[var(--color-border-default)] p-5 md:border-b-0 md:border-r">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              最新スコア
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[42px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                {overall(latest)}
              </span>
              <span className="inline-flex items-center rounded-md bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[12px] font-semibold text-foreground">
                {latest.cefr_level}
              </span>
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              受験日 {fmtDate(latest.tested_at)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span>R {latest.reading}</span>
              <span>L {latest.listening}</span>
              <span>W {latest.writing}</span>
              <span>S {latest.speaking}</span>
            </div>
          </div>

          {/* 受験記録一覧 */}
          <div className="p-2">
            <div className="max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>受験日</TableHead>
                    <TableHead className="text-right">総合</TableHead>
                    <TableHead className="text-right">R</TableHead>
                    <TableHead className="text-right">L</TableHead>
                    <TableHead className="text-right">W</TableHead>
                    <TableHead className="text-right">S</TableHead>
                    <TableHead>CEFR</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {fmtDate(s.tested_at)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {overall(s)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.reading}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.listening}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.writing}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.speaking}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.cefr_level}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(s.id)}
                          aria-label="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      <EfSetDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
