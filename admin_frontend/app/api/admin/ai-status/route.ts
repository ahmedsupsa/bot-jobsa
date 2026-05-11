import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODELS = [
  { id: "gemini-2.0-flash",      label: "Gemini 2.0 Flash",      priority: 1 },
  { id: "gemini-1.5-flash",      label: "Gemini 1.5 Flash",      priority: 2 },
  { id: "gemini-1.5-flash-8b",   label: "Gemini 1.5 Flash 8B",   priority: 3 },
  { id: "gemini-1.5-pro",        label: "Gemini 1.5 Pro",        priority: 4 },
  { id: "gemini-3.1-pro-preview",label: "Gemini 3.1 Pro Preview", priority: 5 },
];

const FEATURES = [
  { key: "cv_parse",        label: "تحليل السيرة الذاتية",        route: "/api/portal/preferences/extract" },
  { key: "cover_letter",    label: "رسالة التغطية (Worker)",       route: "supabase/functions/worker" },
  { key: "job_spec",        label: "تخصصات الوظائف (إضافة وظيفة)", route: "/api/admin/jobs" },
  { key: "job_bulk",        label: "رفع وظائف Excel",             route: "/api/admin/jobs/bulk" },
  { key: "job_fetch",       label: "استيراد وظائف تلقائي",         route: "/api/admin/jobs/fetch" },
];

interface ModelResult {
  id: string; label: string; priority: number;
  ok: boolean; latencyMs?: number; status?: number; error?: string; quota?: boolean;
}

async function testModel(key: string, modelId: string): Promise<ModelResult> {
  const model = MODELS.find(m => m.id === modelId)!;
  if (!key) return { id: model.id, label: model.label, priority: model.priority, ok: false, error: "GEMINI_API_KEY غير مضبوط" };

  const t0 = Date.now();
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "قل: نعم" }] }] }),
        signal: AbortSignal.timeout(10000),
      }
    );
    const latencyMs = Date.now() - t0;
    if (r.status === 429) {
      return { id: model.id, label: model.label, priority: model.priority, ok: false, status: 429, quota: true, latencyMs, error: "تجاوز الحصة (429)" };
    }
    if (r.status === 404) {
      return { id: model.id, label: model.label, priority: model.priority, ok: false, status: 404, latencyMs, error: "النموذج غير متاح (404)" };
    }
    if (!r.ok) {
      const txt = await r.text();
      return { id: model.id, label: model.label, priority: model.priority, ok: false, status: r.status, latencyMs, error: txt.slice(0, 100) };
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { id: model.id, label: model.label, priority: model.priority, ok: !!text, latencyMs, status: r.status };
  } catch (e: any) {
    return { id: model.id, label: model.label, priority: model.priority, ok: false, latencyMs: Date.now() - t0, error: e.message };
  }
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    return NextResponse.json({
      ok: false,
      key_set: false,
      models: [],
      active_model: null,
      features_ok: false,
      features: FEATURES,
    });
  }

  // فحص جميع النماذج بالتوازي
  const results = await Promise.all(MODELS.map(m => testModel(key, m.id)));

  // أول نموذج يعمل هو النموذج الفعلي الذي سيستخدمه النظام
  const activeModel = results.find(r => r.ok) || null;

  return NextResponse.json({
    ok: !!activeModel,
    key_set: true,
    active_model: activeModel?.id || null,
    active_model_label: activeModel?.label || null,
    active_latency_ms: activeModel?.latencyMs || null,
    models: results,
    features: FEATURES,
    features_ok: !!activeModel,
    checked_at: new Date().toISOString(),
  });
}
