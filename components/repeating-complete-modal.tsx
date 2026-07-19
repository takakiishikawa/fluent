"use client";

import type { ReactNode } from "react";
import { Sparkles, Trophy } from "lucide-react";

type RepeatingCompleteModalProps = {
  open: boolean;
  title: string;
  subtitle: string;
  itemCount?: number;
  children: ReactNode;
};

export function RepeatingCompleteModal({
  open,
  title,
  subtitle,
  itemCount,
  children,
}: RepeatingCompleteModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md animate-celebrate-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repeating-complete-title"
    >
      <div className="relative w-full max-w-sm animate-celebrate-pop">
        {/* Soft gradient halo behind the card */}
        <div
          aria-hidden
          className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-[color:var(--color-primary)]/25 via-[color:var(--color-success)]/15 to-transparent blur-2xl animate-celebrate-glow"
        />

        <div
          className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-elevated)] shadow-xl"
          style={{
            boxShadow:
              "0 20px 50px -20px oklch(52% 0.19 290 / 0.3), 0 8px 24px -12px rgba(0, 0, 0, 0.18)",
          }}
        >
          {/* Top decorative gradient band */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[color:var(--color-primary)]/10 via-[color:var(--color-success-subtle)]/40 to-transparent"
          />

          {/* Twinkling sparkles (decorative) */}
          <Sparkles
            aria-hidden
            className="absolute left-6 top-6 h-3.5 w-3.5 text-[color:var(--color-primary)]/70 animate-celebrate-twinkle"
            style={{ animationDelay: "0s" }}
          />
          <Sparkles
            aria-hidden
            className="absolute right-8 top-10 h-3 w-3 text-[color:var(--color-success)]/70 animate-celebrate-twinkle"
            style={{ animationDelay: "0.6s" }}
          />
          <Sparkles
            aria-hidden
            className="absolute left-10 top-24 h-2.5 w-2.5 text-[color:var(--color-warning)]/70 animate-celebrate-twinkle"
            style={{ animationDelay: "1.2s" }}
          />
          <Sparkles
            aria-hidden
            className="absolute right-5 top-28 h-2.5 w-2.5 text-[color:var(--color-primary)]/60 animate-celebrate-twinkle"
            style={{ animationDelay: "1.8s" }}
          />

          <div className="relative px-7 pt-9 pb-7 text-center">
            {/* Trophy with gradient halo */}
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full bg-gradient-to-br from-[color:var(--color-primary)]/20 via-[color:var(--color-success)]/15 to-[color:var(--color-warning)]/10 blur-md animate-celebrate-glow"
              />
              <div
                aria-hidden
                className="absolute inset-1 rounded-full bg-gradient-to-br from-[color:var(--color-success-subtle)] to-[color:var(--color-info-subtle)]"
              />
              <Trophy
                className="relative h-9 w-9 text-[color:var(--color-primary)]"
                strokeWidth={1.75}
              />
            </div>

            <h2
              id="repeating-complete-title"
              className="text-[26px] font-semibold leading-tight tracking-tight bg-gradient-to-r from-[color:var(--color-text-primary)] via-[color:var(--color-primary)] to-[color:var(--color-success)] bg-clip-text text-transparent"
            >
              {title}
            </h2>

            <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
              {subtitle}
            </p>

            {typeof itemCount === "number" && itemCount > 0 && (
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]">
                <Sparkles className="h-3 w-3 text-[color:var(--color-primary)]" />
                {itemCount} 問 完走
              </div>
            )}

            <div className="mt-6 space-y-2 text-left">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
