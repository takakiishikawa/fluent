import { NextRequest, NextResponse } from "next/server";

// リピーティング画面の「日本語」ボタン用。会話の各行を日本語へ翻訳する。
// Google Cloud Translation API v2（APIキー方式・TTS と同じ Google プロジェクト）。
export async function POST(req: NextRequest) {
  const { texts } = (await req.json()) as { texts?: string[] };

  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: "texts is required" }, { status: 400 });
  }

  const apiKey =
    process.env.GOOGLE_TRANSLATE_API_KEY ?? process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_TRANSLATE_API_KEY not configured" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, target: "ja", format: "text" }),
    },
  );

  if (!res.ok) {
    const raw = await res.text();
    console.error("Google Translate error:", raw);
    let message = `翻訳API エラー (${res.status})`;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep default message
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = (await res.json()) as {
    data?: { translations?: { translatedText: string }[] };
  };
  const translations = (data.data?.translations ?? []).map(
    (t) => t.translatedText,
  );
  return NextResponse.json({ translations });
}
