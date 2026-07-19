"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  GO_APPS,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@takaki/go-design-system";
import {
  Settings,
  ExternalLink,
  Home,
  Repeat,
  Headphones,
  PenLine,
  BookOpen,
  MessagesSquare,
  BarChart3,
  Languages,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/types";
import { setCurrentLanguage } from "@/app/actions/language";
import { FluentMark } from "@/components/brand/fluent-mark";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 表示対象の言語。未指定なら全言語で表示 */
  languages?: Language[];
};

/** プライマリナビ（常時表示）— アイコンは NativeGo Concepts.dc.html の実アイコンに準拠 */
const primaryNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/repeating", label: "Repeating", icon: Repeat },
  { href: "/shadowing", label: "Shadowing", icon: Headphones },
  { href: "/output", label: "Output", icon: PenLine },
  { href: "/library", label: "Input", icon: BookOpen, languages: ["en"] },
  { href: "/phrases", label: "Phrases", icon: MessagesSquare, languages: ["vi"] },
  { href: "/list", label: "Library", icon: BookOpen, languages: ["vi"] },
];

/** プロフィール行ホバーで出すポップオーバー内ナビ */
const popoverNavItems: NavItem[] = [{ href: "/report", label: "Report", icon: BarChart3 }];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/repeating") return pathname.startsWith("/repeating");
  if (href === "/library")
    return (
      pathname === "/library" ||
      pathname === "/grammar" ||
      pathname === "/phrases" ||
      pathname === "/texts"
    );
  if (href === "/list") return pathname === "/list";
  return pathname.startsWith(href);
}

const OTHER_APPS = GO_APPS.filter((a) => a.name !== "Fluent");

export function FluentSidebar({
  currentLanguage,
}: {
  currentLanguage: Language;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [switchingLang, setSwitchingLang] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setDisplayName(
        user.user_metadata?.display_name || user.email?.split("@")[0] || "User",
      );
      setAvatarUrl(user.user_metadata?.avatar_url || "");
    });
  }, []);

  // Shadowing のナビラベルを固定チャンネル（講師）名に差し替える。
  // EN は実際のチューター名 "Ryan" で固定（デザイン仕様通り）。
  useEffect(() => {
    if (currentLanguage === "en") {
      setChannelName("Ryan");
      return;
    }
    supabase
      .from("youtube_channels")
      .select("channel_name")
      .eq("language", currentLanguage)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setChannelName(data?.[0]?.channel_name ?? "");
      });
  }, [supabase, currentLanguage]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const otherLanguage: Language = currentLanguage === "en" ? "vi" : "en";
  async function handleSwitchLanguage() {
    if (switchingLang) return;
    setSwitchingLang(true);
    await setCurrentLanguage(otherLanguage);
    router.refresh();
    setSwitchingLang(false);
  }

  const visiblePrimary = primaryNavItems.filter(
    ({ languages }) => !languages || languages.includes(currentLanguage),
  );
  const visiblePopover = popoverNavItems.filter(
    ({ languages }) => !languages || languages.includes(currentLanguage),
  );

  return (
    <Sidebar collapsible="none">
      <SidebarHeader className="px-1.5 py-0">
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <FluentMark size={30} />
          <span
            className="truncate text-[18px] font-bold text-foreground"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Fluent
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visiblePrimary.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname);
                const shownLabel =
                  href === "/shadowing" && channelName
                    ? channelName.split(" ")[0]
                    : label;
                return (
                  <SidebarMenuItem key={href}>
                    <Link
                      href={href}
                      className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14.5px] font-medium transition-colors ${
                        active
                          ? "bg-[var(--color-primary-soft)] font-semibold text-[color:var(--color-primary)]"
                          : "text-muted-foreground hover:bg-[var(--color-surface-subtle)]"
                      }`}
                    >
                      <Icon
                        className="h-[18px] w-[18px] shrink-0"
                        style={{ color: active ? "var(--color-primary)" : "var(--color-text-secondary)" }}
                      />
                      {shownLabel}
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <HoverCard openDelay={80} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div
              className="flex cursor-default items-center gap-2.5 px-3 py-2.5"
              style={{ borderTop: "1px solid var(--color-border-default)" }}
            >
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-text-primary)" }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  (displayName || "U").charAt(0).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-foreground">
                  {displayName || "—"}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  English practice
                </div>
              </div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="top" align="start" className="w-52 p-1">
            <div className="flex flex-col gap-0.5">
              <button
                onClick={handleSwitchLanguage}
                disabled={switchingLang}
                className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-50"
              >
                <Languages className="h-4 w-4 shrink-0" />
                Switch to {LANGUAGE_LABELS[otherLanguage]}
              </button>
              {visiblePopover.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
                      active
                        ? "bg-[var(--color-primary-soft)] font-semibold text-[color:var(--color-primary)]"
                        : "text-muted-foreground hover:bg-[var(--color-surface-subtle)]"
                    }`}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: active ? "var(--color-primary)" : "var(--color-text-secondary)" }}
                    />
                    {label}
                  </Link>
                );
              })}
              <Link
                href="/settings"
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  pathname === "/settings"
                    ? "bg-[var(--color-primary-soft)] font-semibold text-[color:var(--color-primary)]"
                    : "text-muted-foreground hover:bg-[var(--color-surface-subtle)]"
                }`}
              >
                <Settings className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-secondary)" }} />
                Settings
              </Link>
              {OTHER_APPS.map((app) => (
                <button
                  key={app.name}
                  onClick={() => {
                    window.location.href = app.url;
                  }}
                  className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-[var(--color-surface-subtle)]"
                >
                  {app.icon ? (
                    <app.icon className="h-4 w-4 shrink-0" />
                  ) : (
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  )}
                  {app.name}
                </button>
              ))}
              <div
                className="my-0.5"
                style={{ height: 1, background: "var(--color-border-default)" }}
              />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-[var(--color-surface-subtle)]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Log out
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>
      </SidebarFooter>
    </Sidebar>
  );
}
