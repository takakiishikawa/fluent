"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Separator,
} from "@takaki/go-design-system";

type Crumb = { label: string; href?: string };

function crumbsFor(pathname: string): Crumb[] | null {
  if (pathname === "/list") return [{ label: "ライブラリ" }];
  if (pathname === "/texts") return [{ label: "Input", href: "/library" }];
  if (pathname === "/library") return [{ label: "Input" }];
  return null;
}

export function HeaderBreadcrumb() {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname);
  if (!crumbs) return null;

  return (
    <>
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className="contents">
                <BreadcrumbItem>
                  {isLast || !c.href ? (
                    <BreadcrumbPage>{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
