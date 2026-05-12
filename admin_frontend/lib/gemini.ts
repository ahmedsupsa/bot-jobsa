const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// نماذج مرتبة من الأعلى حصة إلى الأقل — يجرب كل واحد عند فشل الآخر
const TEXT_MODELS = [
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const MULTIMODAL_MODELS = [
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(
  models: string[],
  parts: GeminiPart[],
  config?: Record<string, unknown>
): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY غير مضبوط");

  const body = {
    contents: [{ parts }],
    ...(config ? { generationConfig: config } : {}),
  };

  let lastError = "";
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (r.status === 429 || r.status === 503) {
        const errText = await r.text();
        lastError = `${model}: ${r.status} — ${errText.slice(0, 100)}`;
        console.warn(`[gemini] quota/unavailable on ${model}, trying next...`);
        continue;
      }

      if (!r.ok) {
        const errText = await r.text();
        lastError = `${model}: ${r.status} — ${errText.slice(0, 100)}`;
        continue;
      }

      const data = await r.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) {
        if (model !== models[0]) console.log(`[gemini] used fallback model: ${model}`);
        return text.trim();
      }

      lastError = `${model}: استجابة فارغة`;
    } catch (e: any) {
      lastError = `${model}: ${e.message}`;
      console.warn(`[gemini] error on ${model}:`, e.message);
    }
  }

  throw new Error(`فشلت جميع نماذج Gemini. آخر خطأ: ${lastError}`);
}

/** استدعاء نصي فقط */
export async function geminiText(prompt: string, config?: Record<string, unknown>): Promise<string> {
  return callGemini(TEXT_MODELS, [{ text: prompt }], config);
}

/** استدعاء مع ملف (PDF/صورة) */
export async function geminiMultimodal(
  prompt: string,
  fileBase64: string,
  mimeType: string,
  config?: Record<string, unknown>
): Promise<string> {
  return callGemini(
    MULTIMODAL_MODELS,
    [{ text: prompt }, { inline_data: { mime_type: mimeType, data: fileBase64 } }],
    config
  );
}
