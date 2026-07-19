"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoginPage } from "@takaki/go-design-system";
import { FluentMark } from "@/components/brand/fluent-mark";

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
    <LoginPage
      productName="Fluent"
      productLogo={<FluentMark size={28} />}
      tagline="英会話レッスン 学習管理アプリ"
      onGoogleSignIn={handleGoogleSignIn}
    />
  );
}

export default function LoginPageRoute() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
