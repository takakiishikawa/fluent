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
  SidebarRail,
  GO_APPS,
  UserMenu,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@takaki/go-design-system";
import { Settings, Sun, Moon, ExternalLink } from "lucide-react";
import type { Language } from "@/lib/types";
import { LanguageSwitch } from "./language-switch";
import { FluentMark } from "@/components/brand/fluent-mark";

type Shape = "square" | "circle";

type NavItem = {
  href: string;
  label: string;
  shape: Shape;
  /** 表示対象の言語。未指定なら全言語で表示 */
  languages?: Language[];
};

/** プライマリナビ（常時表示）— アイコンは色付きドット（design_handoff_fluent_redesign 準拠） */
const primaryNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", shape: "square" },
  { href: "/repeating", label: "Repeating", shape: "circle" },
  { href: "/shadowing", label: "Shadowing", shape: "square" },
  { href: "/output", label: "Output", shape: "circle" },
  { href: "/grammar", label: "Grammar", shape: "square", languages: ["en"] },
  { href: "/phrases", label: "Phrases", shape: "circle", languages: ["vi"] },
  { href: "/list", label: "Library", shape: "square", languages: ["vi"] },
];

/** プロフィール行ホバーで出すポップオーバー内ナビ */
const popoverNavItems: NavItem[] = [
  { href: "/phrases", label: "Phrases", shape: "circle", languages: ["en"] },
  { href: "/report", label: "Report", shape: "square" },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/repeating") return pathname.startsWith("/repeating");
  if (href === "/grammar")
    return pathname === "/grammar" || pathname === "/texts";
  if (href === "/list") return pathname === "/list";
  return pathname.startsWith(href);
}

const OTHER_APPS = GO_APPS.filter((a) => a.name !== "NativeGo");

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

  // Shadowing のナビラベルを固定チャンネル（講師）名の下の名前に差し替える
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
              {visiblePrimary.map(({ href, label, shape }) => {
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
                      <span
                        className="h-2 w-2 shrink-0"
                        style={{
                          borderRadius: shape === "circle" ? "50%" : 3,
                          background: active
                            ? "var(--color-primary)"
                            : "var(--color-text-secondary)",
                        }}
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
                  ...OTHER_APPS.map((app) => ({
                    title: app.name,
                    icon: app.icon ?? ExternalLink,
                    onSelect: () => {
                      window.location.href = app.url;
                    },
                  })),
                ]}
                signOut={{ onSelect: handleSignOut }}
              />
            </div>
          </HoverCardTrigger>
          {visiblePopover.length > 0 && (
            <HoverCardContent side="top" align="start" className="w-48 p-1">
              <div className="flex flex-col gap-0.5">
                {visiblePopover.map(({ href, label, shape }) => {
                  const active =
                    (pathname === "/phrases" && href === "/phrases") ||
                    (pathname === "/report" && href === "/report");
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
                      <span
                        className="h-2 w-2 shrink-0"
                        style={{
                          borderRadius: shape === "circle" ? "50%" : 3,
                          background: active
                            ? "var(--color-primary)"
                            : "var(--color-text-secondary)",
                        }}
                      />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </HoverCardContent>
          )}
        </HoverCard>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
