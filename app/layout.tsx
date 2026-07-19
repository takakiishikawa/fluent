import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { DesignTokens, Toaster } from "@takaki/go-design-system";
import { NativeGoShell } from "@/components/layout/native-go-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { DarkModeInit } from "@/components/dark-mode-init";
import { LoginToast } from "@/components/login-toast";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fluent",
  description: "英会話レッスン学習管理アプリ",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentLanguage = user ? await getCurrentLanguage() : "en";

  return (
    <html
      lang="ja"
      className={`${jakarta.variable} ${notoSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <DarkModeInit />
        <DesignTokens
          primaryColor="oklch(52% 0.19 290)"
          primaryColorHover="oklch(45% 0.19 290)"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--sidebar-accent:290 45% 90%;--sidebar-accent-foreground:290 60% 28%}.dark{--sidebar-accent:218 55% 16%;--sidebar-accent-foreground:218 65% 82%}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {user ? (
          <NativeGoShell currentLanguage={currentLanguage}>
            <Suspense>
              <LoginToast />
            </Suspense>
            {children}
          </NativeGoShell>
        ) : (
          <main>{children}</main>
        )}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
