"use client";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@takaki/go-design-system";
import { NativeGoSidebar } from "./native-go-sidebar";
import { HeaderBreadcrumb } from "./header-breadcrumb";
import type { Language } from "@/lib/types";
import { LanguageProvider } from "@/lib/language-context";

export function NativeGoShell({
  currentLanguage,
  children,
}: {
  currentLanguage: Language;
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider value={currentLanguage}>
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "232px" } as React.CSSProperties}>
        <NativeGoSidebar currentLanguage={currentLanguage} />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <HeaderBreadcrumb />
          </header>
          <main className="@container/main flex flex-1 flex-col gap-4 p-4">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </LanguageProvider>
  );
}
