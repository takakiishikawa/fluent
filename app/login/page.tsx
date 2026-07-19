"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FluentMark } from "@/components/brand/fluent-mark";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--color-background)" }}
    >
      <div
        className="w-full max-w-sm rounded-[24px] p-9 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-default)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div className="mb-5 flex justify-center">
          <FluentMark size={56} />
        </div>

        <h1 className="mb-2 text-[26px] font-bold text-foreground">Fluent</h1>

        <p className="mb-7 text-[14.5px] leading-relaxed text-muted-foreground">
          Your personal English speaking practice,
          <br />
          ahead of your next lesson.
        </p>

        {error && (
          <p className="mb-4 text-[13px] text-destructive">
            Something went wrong signing in. Please try again.
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="mb-6 flex w-full items-center justify-center gap-3 rounded-full py-3 text-[15px] font-semibold text-foreground transition-colors hover:bg-[var(--color-surface-subtle)]"
          style={{ border: "1px solid var(--color-border-default)" }}
        >
          <GoogleIcon className="h-5 w-5 shrink-0" />
          Sign in with Google
        </button>

        <p className="text-[13px] text-muted-foreground">
          A private practice tool for one learner.
        </p>
      </div>
    </div>
  );
}

export default function LoginPageRoute() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
