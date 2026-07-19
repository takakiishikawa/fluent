"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button, PageHeader } from "@takaki/go-design-system";
import { FileText } from "lucide-react";
import Link from "next/link";
import { GrammarTab } from "@/app/list/page";
import { useCurrentLanguage } from "@/lib/language-context";

export default function GrammarCatalogPage() {
  const language = useCurrentLanguage();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (language === "vi") router.replace("/list");
  }, [language, router]);

  if (language === "vi") return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="文法カタログ"
        actions={
          <Button variant="outline" asChild>
            <Link href="/texts">
              <FileText className="mr-1.5 h-4 w-4" />
              テキスト管理
            </Link>
          </Button>
        }
      />
      <GrammarTab reloadKey={reloadKey} bumpReload={bumpReload} />
    </div>
  );
}
