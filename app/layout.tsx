import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { DesignTokens, Toaster } from "@takaki/go-design-system";
import { FluentShell } from "@/components/layout/fluent-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
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
        <DesignTokens
          primaryColor="oklch(52% 0.19 290)"
          primaryColorHover="oklch(45% 0.19 290)"
        />
        {/*
          DesignTokens は tokens.css のデフォルト値を <style> で注入するため、
          app/globals.css 内の :root 上書きは DOM順で負けて無効化される。
          ここで DesignTokens の後に注入することで確実に上書きする。
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
:root{
  /* DSのbg-sidebarはhsl(var(--sidebar-background))を直接参照するため、
     --color-sidebar(oklch)とは別にこちらも --color-surface と揃えておく必要がある */
  --sidebar-background:34.3 77.8% 98.2%;
  --sidebar-accent:290 45% 90%;--sidebar-accent-foreground:290 60% 28%;
  --color-background: oklch(97.5% 0.014 75);
  --color-surface: oklch(99% 0.006 75);
  --color-surface-subtle: oklch(95.5% 0.016 75);
  --color-surface-elevated: oklch(99% 0.006 75);
  --color-text-primary: oklch(24% 0.03 280);
  --color-text-secondary: oklch(52% 0.02 75);
  --color-text-subtle: oklch(60% 0.02 75);
  --color-border-subtle: oklch(92.5% 0.012 75);
  --color-border-default: oklch(90% 0.012 75);
  --color-border-strong: oklch(80% 0.02 75);
  --color-accent: oklch(74% 0.15 55);
  --color-accent-soft: oklch(92% 0.05 55);
  --color-primary-soft: oklch(90% 0.05 290);
  --shadow-md: 0 2px 10px oklch(50% 0.05 290 / 0.08);
  --radius-lg: 12px;
  --radius-xl: 20px;
  --color-heatmap-0: oklch(93% 0.01 75);
  --color-heatmap-1: oklch(85% 0.08 55);
  --color-heatmap-2: oklch(75% 0.13 55);
  --color-heatmap-3: oklch(62% 0.17 290);
  --color-heatmap-4: oklch(48% 0.2 290);
  --color-sidebar-accent: oklch(90% 0.05 290);
  --color-sidebar-accent-foreground: oklch(30% 0.15 290);
  --color-sidebar-foreground: var(--color-text-primary);
  --color-sidebar: var(--color-surface);
  --color-sidebar-border: var(--color-border-subtle);
  --color-sidebar-ring: var(--color-primary);
  --color-sidebar-primary: var(--color-primary);
  --color-sidebar-primary-foreground: var(--color-primary-text);
  --color-grammar: #5b6af0;
  --color-phrase: #0d9488;
  --color-speaking: #d97706;
  --color-shadow: #7c3aed;
  --color-primary-chart-2: oklch(74% 0.15 55);
  --color-primary-chart-3: #0d9488;
}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {user ? (
          <FluentShell currentLanguage={currentLanguage}>
            <Suspense>
              <LoginToast />
            </Suspense>
            {children}
          </FluentShell>
        ) : (
          <main>{children}</main>
        )}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
