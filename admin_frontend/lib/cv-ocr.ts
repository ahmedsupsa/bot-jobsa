// OCR للسير المصورة (scanned PDF) باستخدام Hugging Face Inference API
// يعمل على Vercel (يتطلب Node.js مع DOMMatrix و @napi-rs/canvas)

const HF_API = "https://api-inference.huggingface.co/models";
// نموذج OCR مجاني — يتعرف على النص العربي والإنجليزي من الصور
const OCR_MODEL = "microsoft/trocr-base-printed";

function getHfToken(): string | null {
  if (typeof process !== "undefined" && process.env?.HF_TOKEN) return process.env.HF_TOKEN;
  return null;
}

async function callHfOcr(imageBuffer: Buffer): Promise<string | null> {
  const token = getHfToken();
  if (!token) return null;
  try {
    const res = await fetch(`${HF_API}/${OCR_MODEL}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    });
    if (!res.ok) { console.warn(`[cv-ocr] HF error ${res.status}`); return null; }
    const data = await res.json();
    return data?.[0]?.generated_text || null;
  } catch { return null; }
}

export async function extractTextWithOcr(buffer: Buffer): Promise<string | null> {
  const token = getHfToken();
  if (!token) return null;

  try {
    // dynamic import — يشتغل على Vercel فقط (DOMMatrix + @napi-rs/canvas موجودين)
    let pdfjsLib: any;
    try {
      pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    } catch {
      console.warn("[cv-ocr] pdfjs-dist غير متاح");
      // محاولة مسح الملف كصورة مباشرة (بعض السير كل صفحة صورة)
      const text = await callHfOcr(buffer);
      if (text && text.length > 20) return text;
      return null;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const texts: string[] = [];

    for (let i = 1; i <= Math.min(pageCount, 5); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = pdfjsLib.canvas?.createCanvas?.(viewport.width, viewport.height);

      if (canvas) {
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const pngBuffer = canvas.toBuffer?.("image/png");
        if (pngBuffer) {
          const pageText = await callHfOcr(pngBuffer);
          if (pageText) texts.push(pageText);
        }
      } else {
        // canvas غير متاح -> نجرب نرسل البايت المباشر
        const text = await callHfOcr(buffer);
        if (text && text.length > 20) texts.push(text);
        break;
      }
      page.cleanup();
    }

    await pdf.destroy();
    const combined = texts.join("\n").trim();
    return combined.length > 50 ? combined : null;

  } catch (err) {
    console.warn("[cv-ocr] فشل:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
