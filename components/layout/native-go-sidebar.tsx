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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  AppSwitcher,
  GO_APPS,
  UserMenu,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@takaki/go-design-system";
import {
  Home,
  Repeat2,
  Volume2,
  MessagesSquare,
  BookOpen,
  PenLine,
  BarChart3,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import type { Language } from "@/lib/types";
import { LanguageSwitch } from "./language-switch";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  /** 表示対象の言語。未指定なら全言語で表示 */
  languages?: Language[];
};

/** プライマリナビ（常時表示） */
const primaryNavItems: NavItem[] = [
  { href: "/", label: "ダッシュボード", icon: Home },
  { href: "/repeating", label: "リピーティング", icon: Repeat2 },
  { href: "/shadowing", label: "シャドーイング", icon: Volume2 },
  { href: "/output", label: "アウトプット", icon: PenLine },
  { href: "/grammar", label: "文法", icon: BookOpen, languages: ["en"] },
  {
    href: "/phrases",
    label: "フレーズ",
    icon: MessagesSquare,
    languages: ["vi"],
  },
  {
    href: "/list",
    label: "ライブラリ",
    icon: BookOpen,
    languages: ["vi"],
  },
];

/** プロフィール行ホバーで出すポップオーバー内ナビ */
const popoverNavItems: NavItem[] = [
  {
    href: "/phrases",
    label: "フレーズカタログ",
    icon: MessagesSquare,
    languages: ["en"],
  },
  { href: "/report", label: "レポート", icon: BarChart3 },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/repeating") return pathname.startsWith("/repeating");
  if (href === "/grammar")
    return pathname === "/grammar" || pathname === "/texts";
  if (href === "/list") return pathname === "/list";
  return pathname.startsWith(href);
}

export function NativeGoSidebar({
  currentLanguage,
}: {
  currentLanguage: Language;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [channelName, setChannelName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setDisplayName(
        user.user_metadata?.display_name || user.email?.split("@")[0] || "User",
      );
      setEmail(user.email || "");
      setAvatarUrl(user.user_metadata?.avatar_url || "");
    });
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // Shadowing のナビラベルを固定チャンネル（講師）名に差し替える
  useEffect(() => {
    supabase
      .from("youtube_channels")
      .select("channel_name")
      .eq("language", currentLanguage)
      .eq("archived", false)
      .order("created_at")
      .limit(1)
      .then(({ data }) => {
        setChannelName(data?.[0]?.channel_name ?? "");
      });
  }, [supabase, currentLanguage]);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const visiblePrimary = primaryNavItems.filter(
    ({ languages }) => !languages || languages.includes(currentLanguage),
  );
  const visiblePopover = popoverNavItems.filter(
    ({ languages }) => !languages || languages.includes(currentLanguage),
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <AppSwitcher currentApp="NativeGo" apps={GO_APPS} placement="bottom" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimary.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={isActive(href, pathname)}>
                    <Link href={href}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {href === "/shadowing" && channelName ? channelName : label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LanguageSwitch current={currentLanguage} />
          </SidebarMenuItem>
        </SidebarMenu>

        <HoverCard openDelay={80} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div>
              <UserMenu
                displayName={displayName || "—"}
                email={email}
                avatarUrl={avatarUrl}
                items={[
                  {
                    title: "設定",
                    icon: Settings,
                    onSelect: () => router.push("/settings"),
                    isActive: pathname.startsWith("/settings"),
                  },
                  {
                    title: isDark ? "ダーク" : "ライト",
                    icon: isDark ? Moon : Sun,
                    onSelect: toggleTheme,
                  },
                ]}
                signOut={{ onSelect: handleSignOut }}
              />
            </div>
          </HoverCardTrigger>
          {visiblePopover.length > 0 && (
            <HoverCardContent
              side="top"
              align="start"
              className="w-48 p-1.5"
            >
              <div className="flex flex-col">
                {visiblePopover.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-[var(--color-sidebar-accent)] transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {label}
                  </Link>
                ))}
              </div>
            </HoverCardContent>
          )}
        </HoverCard>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
