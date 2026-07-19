"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@takaki/go-design-system";
import { FileText } from "lucide-react";
import Link from "next/link";
import { CatalogTable } from "@/components/catalog-table";
import { useCurrentLanguage } from "@/lib/language-context";

export default function GrammarCatalogPage() {
  const language = useCurrentLanguage();
  const router = useRouter();

  useEffect(() => {
    if (language === "vi") router.replace("/list");
  }, [language, router]);

  if (language === "vi") return null;

  return (
    <div className="w-full max-w-[980px]">
      <div
        className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-accent)" }}
      >
        Library
      </div>
      <div className="mb-[22px] flex items-center justify-between">
        <h1 className="text-[30px] font-bold text-foreground">Grammar catalog</h1>
        <Button variant="outline" asChild>
          <Link href="/texts">
            <FileText className="mr-1.5 h-4 w-4" />
            テキスト管理
          </Link>
        </Button>
      </div>
      <CatalogTable kind="grammar" />
    </div>
  );
}
