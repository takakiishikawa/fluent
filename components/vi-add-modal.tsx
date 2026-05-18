"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from "@takaki/go-design-system";
import { Trash2 } from "lucide-react";
import {
  saveGrammar,
  saveExpressions,
  saveWords,
} from "@/app/actions/practice";
import type {
  ExtractResult,
  ExtractedExpression,
  ExtractedGrammar,
  ExtractedWord,
} from "@/lib/types";
import { CategoryTag } from "@/components/category-tag";

type WithPriority<T> = T & { is_priority: boolean };

const LOADING_STEPS = [
  "入力を解析中...",
  "文法・フレーズ・単語を仕分け中...",
  "単語ごとの解説を生成中...",
  "ニュアンスを書き出し中...",
  "整形中...",
];

const PLACEHOLDER = `学習したいテキストをそのまま貼り付けてください。
レッスンの宿題・教材・例文など、何でも OK です。

AI が内容を文法・フレーズ・単語に仕分けし、それぞれに練習用の会話例と解説を付けて生成します。`;

export function ViAddModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [grammar, setGrammar] = useState<WithPriority<ExtractedGrammar>[]>([]);
  const [expressions, setExpressions] = useState<
    WithPriority<ExtractedExpression>[]
  >([]);
  const [words, setWords] = useState<WithPriority<ExtractedWord>[]>([]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [hasResult, setHasResult] = useState(false);

  const hasInput = text.trim().length > 0;
  const totalCount = grammar.length + expressions.length + words.length;

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleExtract() {
    if (!hasInput) return;
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          language: "vi",
        }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as ExtractResult;
      setGrammar(
        (data.grammar ?? []).map((g) => ({ ...g, is_priority: false })),
      );
      setExpressions(
        (data.expressions ?? []).map((e) => ({ ...e, is_priority: false })),
      );
      setWords(
        (data.words ?? []).map((w) => ({ ...w, is_priority: false })),
      );
      setSourceTitle(data.source_title ?? "");
      setHasResult(true);
    } catch {
      toast.error("仕分けに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (totalCount === 0) {
      toast.error("追加する項目がありません");
      return;
    }
    setSaving(true);
    const trimmedTitle = sourceTitle.trim();
    const titleArg = trimmedTitle ? trimmedTitle : null;

    // 部分成功でも何が保存されたか分かるよう、カテゴリごとに try/catch する
    const saved: string[] = [];
    const failed: string[] = [];
    let savedGrammarCount = 0;
    let savedExpressionsCount = 0;
    let savedWordsResult = { inserted: 0, skipped: 0 };

    if (grammar.length > 0) {
      try {
        await saveGrammar(
          grammar.map((g) => ({ ...g, source_title: titleArg })),
        );
        savedGrammarCount = grammar.length;
        saved.push(`文法 ${grammar.length}件`);
      } catch (err) {
        console.error("[vi-add] saveGrammar failed:", err);
        failed.push("文法");
      }
    }

    if (expressions.length > 0) {
      try {
        await saveExpressions(
          expressions.map((e) => ({ ...e, source_title: titleArg })),
        );
        savedExpressionsCount = expressions.length;
        saved.push(`フレーズ ${expressions.length}件`);
      } catch (err) {
        console.error("[vi-add] saveExpressions failed:", err);
        failed.push("フレーズ");
      }
    }

    if (words.length > 0) {
      try {
        savedWordsResult = await saveWords(
          words.map((w) => ({ ...w, source_title: titleArg })),
        );
        if (savedWordsResult.skipped > 0) {
          saved.push(
            `単語 ${savedWordsResult.inserted}件（重複${savedWordsResult.skipped}件除外）`,
          );
        } else {
          saved.push(`単語 ${savedWordsResult.inserted}件`);
        }
      } catch (err) {
        console.error("[vi-add] saveWords failed:", err);
        failed.push("単語");
      }
    }

    setSaving(false);

    // 保存できた分のローカル状態を更新して、未保存ぶんだけモーダルに残す
    if (savedGrammarCount > 0) setGrammar([]);
    if (savedExpressionsCount > 0) setExpressions([]);
    if (savedWordsResult.inserted > 0 || savedWordsResult.skipped > 0) {
      setWords([]);
    }

    if (failed.length === 0) {
      toast.success(`${saved.join("・")}を追加しました`);
      onSaved();
      onClose();
    } else if (saved.length > 0) {
      toast.error(
        `${saved.join("・")}は追加できましたが、${failed.join("・")}の保存に失敗しました（コンソールにエラー詳細）`,
      );
      onSaved();
    } else {
      toast.error(
        `${failed.join("・")}の保存に失敗しました（コンソールにエラー詳細）`,
      );
    }
  }

  function backToInput() {
    setHasResult(false);
    setGrammar([]);
    setExpressions([]);
    setWords([]);
    setSourceTitle("");
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-5xl flex flex-col max-h-[88vh] gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>テキストから練習コンテンツを生成</DialogTitle>
          <DialogDescription>
            学習したいテキストを貼り付けると、AI がオリジナルの練習用コンテンツ（文法・フレーズ・単語と会話例）を生成します。確認画面で不要な行を削除し、まとめてライブラリに追加できます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center gap-5 py-8">
              <Spinner size="lg" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">
                  {LOADING_STEPS[loadingStep]}
                </p>
                <p className="text-xs text-muted-foreground">
                  通常15〜30秒かかります
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-[3000ms] ease-out"
                    style={{
                      width: `${((loadingStep + 1) / LOADING_STEPS.length) * 85}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-0.5">
                  {LOADING_STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={
                        i <= loadingStep ? "text-primary font-medium" : ""
                      }
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : hasResult ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="vi-add-source-title">
                  ソースタイトル (任意)
                </Label>
                <Input
                  id="vi-add-source-title"
                  value={sourceTitle}
                  onChange={(ev) => setSourceTitle(ev.target.value)}
                  placeholder="例: Lesson 3 / 旅行の英会話"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  どのレッスン由来か追跡できるようにします。空欄でも保存可。
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                文法 {grammar.length}件・フレーズ {expressions.length}件・単語{" "}
                {words.length}件を抽出しました。不要な行は{" "}
                <Trash2 className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
                で削除してから追加してください。
              </p>

              {grammar.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    文法 ({grammar.length})
                  </Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px]">種別</TableHead>
                          <TableHead className="w-[200px]">文法名</TableHead>
                          <TableHead>概要</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grammar.map((g, i) => (
                          <TableRow key={`g-${i}`} className="align-top">
                            <TableCell>
                              <CategoryTag category={g.category} />
                            </TableCell>
                            <TableCell className="font-medium text-[color:var(--color-grammar)]">
                              {g.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {g.summary}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setGrammar((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  )
                                }
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
              )}

              {expressions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    フレーズ ({expressions.length})
                  </Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px]">種別</TableHead>
                          <TableHead className="w-[200px]">フレーズ</TableHead>
                          <TableHead>意味</TableHead>
                          <TableHead>ニュアンス</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expressions.map((e, i) => (
                          <TableRow key={`e-${i}`} className="align-top">
                            <TableCell>
                              <CategoryTag category={e.category} />
                            </TableCell>
                            <TableCell className="font-medium text-[color:var(--color-phrase)]">
                              {e.expression}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.meaning}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {e.nuance ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setExpressions((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  )
                                }
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
              )}

              {words.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    単語 ({words.length})
                  </Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[130px]">カテゴリ</TableHead>
                          <TableHead className="w-[180px]">単語</TableHead>
                          <TableHead>意味</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {words.map((w, i) => (
                          <TableRow key={`w-${i}`} className="align-top">
                            <TableCell>
                              <CategoryTag category={w.category} />
                            </TableCell>
                            <TableCell className="font-medium">
                              {w.word}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {w.meaning}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setWords((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  )
                                }
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
              )}

              {totalCount === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  全件削除されました。入力に戻ってやり直してください。
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="vi-add-text">レッスンテキスト</Label>
                <p className="text-xs text-muted-foreground">
                  AIが文法・フレーズ・単語の3カテゴリに自動仕分けします。
                </p>
                <Textarea
                  id="vi-add-text"
                  value={text}
                  onChange={(ev) => setText(ev.target.value)}
                  placeholder={PLACEHOLDER}
                  className="min-h-48 font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {!loading && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            {hasResult ? (
              <>
                <Button
                  variant="outline"
                  onClick={backToInput}
                  disabled={saving}
                >
                  入力に戻る
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || totalCount === 0}
                >
                  {saving && <Spinner size="sm" className="mr-2" />}
                  {saving ? "追加中..." : `${totalCount}件を追加する`}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={onClose}>
                  キャンセル
                </Button>
                <Button onClick={handleExtract} disabled={!hasInput}>
                  仕分けする
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
