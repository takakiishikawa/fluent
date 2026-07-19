"use client";

import { SidebarProvider, SidebarInset } from "@takaki/go-design-system";
import { FluentSidebar } from "./fluent-sidebar";
import type { Language } from "@/lib/types";
import { LanguageProvider } from "@/lib/language-context";

export function FluentShell({
  currentLanguage,
  children,
}: {
  currentLanguage: Language;
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider value={currentLanguage}>
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "232px" } as React.CSSProperties}>
        <FluentSidebar currentLanguage={currentLanguage} />
        <SidebarInset>
          <main className="@container/main flex flex-1 flex-col gap-4 p-4">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </LanguageProvider>
  );
}
