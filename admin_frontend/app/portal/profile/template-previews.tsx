import { AlignLeft, Sparkles, Zap } from "lucide-react";

export const TEMPLATE_META: Record<string, { name: string; tag: string; desc: string }> = {
  classic: { name: "الكلاسيكي", tag: "موصى به",  desc: "أسلوب رسمي ومنظّم مناسب للشركات الكبرى والمؤسسات" },
  modern:  { name: "الحديث",    tag: "عصري",      desc: "أسلوب ودّي وعصري مناسب للشركات الناشئة والتقنية" },
  brief:   { name: "المختصر",   tag: "مباشر",     desc: "موجز ومباشر، يوفّر وقت المسؤول ويُبرز المهارات بسرعة" },
};

export const TEMPLATE_IDS = ["classic", "modern", "brief"];

function ClassicPreview() {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 9, color: "#333", direction: "rtl", lineHeight: 1.8, height: "100%" }}>
      <div style={{ fontWeight: 800, borderBottom: "1px solid #eee", paddingBottom: 5, marginBottom: 5, color: "#111", fontSize: 10 }}>طلب توظيف — مهندس برمجيات</div>
      <div style={{ color: "#555", marginBottom: 3 }}>السادة المحترمون،</div>
      <div style={{ color: "#666" }}>أتقدم بكل احترام للتقديم على هذه الوظيفة استناداً لخبرتي الواسعة في...</div>
      <div style={{ marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 5, color: "#999", fontSize: 8, display: "flex", justifyContent: "space-between" }}>
        <span>الاسم الكامل</span><span>الجوال</span>
      </div>
    </div>
  );
}

function ModernPreview() {
  return (
    <div style={{ background: "#0f0a1e", borderRadius: 8, padding: "10px 12px", fontSize: 9, color: "#eee", direction: "rtl", lineHeight: 1.8, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(135deg,#a78bfa,#60a5fa)", flexShrink: 0 }} />
        <div style={{ fontWeight: 800, color: "#fff", fontSize: 10 }}>مهندس برمجيات</div>
      </div>
      <div style={{ color: "#d4d4d8" }}>{"مرحباً! أنا مهتم جداً بهذه الفرصة وأرى تطابقاً واضحاً مع خبرتي في..."}</div>
      <div style={{ marginTop: 6, color: "#a78bfa", fontSize: 8 }}>{"عرض السيرة الذاتية \u2192"}</div>
    </div>
  );
}

function BriefPreview() {
  const skills = ["5 سنوات خبرة في المجال", "خبرة مثبتة في نفس القطاع", "متاح للبدء فوراً"];
  return (
    <div style={{ background: "#f8f8f8", borderRadius: 8, padding: "10px 12px", fontSize: 9, color: "#333", direction: "rtl", lineHeight: 1.8, height: "100%" }}>
      <div style={{ fontWeight: 800, marginBottom: 6, color: "#111", fontSize: 10 }}>التقديم على: مهندس برمجيات</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {skills.map((skill, idx) => (
          <div key={idx} style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
            <span style={{ color: "#18181b", fontWeight: 800, flexShrink: 0 }}>{"·"}</span>
            <span style={{ color: "#555" }}>{skill}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function getTemplatePreview(id: string): React.ReactNode {
  if (id === "classic") return <ClassicPreview />;
  if (id === "modern") return <ModernPreview />;
  return <BriefPreview />;
}

export function getTemplateIcon(id: string): React.ReactNode {
  if (id === "classic") return <AlignLeft size={18} strokeWidth={1.5} />;
  if (id === "modern") return <Sparkles size={18} strokeWidth={1.5} />;
  return <Zap size={18} strokeWidth={1.5} />;
}
