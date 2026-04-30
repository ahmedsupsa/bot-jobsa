import Shell from "@/components/shell";
import { Zap, BrainCircuit, Mail, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Jobbots — التقديم التلقائي على الوظائف",
  description: "لا تضيّع وقتك في التقديم اليدوي. Jobbots يقوم بالعمل الشاق نيابة عنك.",
};

export default function LandingPage() {
  return (
    <Shell>
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold mb-4">
            <Zap size={14} /> التقديم التلقائي بالذكاء الاصطناعي
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink leading-tight mb-6">
            لا تضيّع وقتك في التقديم اليدوي.<br />
            <span className="text-accent">Jobbots يقوم بالعمل الشاق نيابة عنك.</span>
          </h1>
          <p className="text-muted text-lg mb-8 max-w-2xl mx-auto">
            نستخدم الذكاء الاصطناعي لربط سيرتك الذاتية بأفضل الوظائف المناسبة، وإرسال طلباتك تلقائياً من إيميلك الشخصي بكل احترافية.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/store" className="flex items-center justify-center gap-2 bg-accent text-accent-fg px-8 py-4 rounded-xl font-bold hover:opacity-90 transition-all">
              ابدأ التقديم الآن <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            { icon: Clock, title: "وفّر ساعاتك", desc: "لا داعي لقضاء الساعات أمام الشاشة. نحن نقدّم بدلاً منك." },
            { icon: BrainCircuit, title: "ذكاء اصطناعي دقيق", desc: "خوارزمياتنا تحلل الوظيفة وتصمم رسالة تغطية (Cover Letter) مخصصة." },
            { icon: ShieldCheck, title: "احترافية مطلقة", desc: "التقديم يخرج من إيميلك الشخصي، وكأنك قمت به بنفسك." },
          ].map((item, i) => (
            <div key={i} className="bg-panel border border-line p-6 rounded-2xl">
              <div className="h-12 w-12 rounded-xl bg-panel2 flex items-center justify-center text-accent mb-4">
                <item.icon size={24} />
              </div>
              <h3 className="font-bold text-ink mb-2">{item.title}</h3>
              <p className="text-sm text-muted">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* How it Works */}
        <div className="bg-panel border border-line rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-ink mb-8 text-center">كيف يبدأ Jobbots العمل؟</h2>
          <div className="space-y-6">
            {[
              { step: "01", title: "ارفع سيرتك الذاتية", desc: "نحلل مهاراتك وخبراتك بدقة فائقة." },
              { step: "02", title: "نحلل الوظائف", desc: "نبحث عن الوظائف التي تناسب مؤهلاتك وتفضيلاتك." },
              { step: "03", title: "نقدّم تلقائياً", desc: "نرسل طلبك مع رسالة تغطية احترافية فوراً." },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-2xl font-black text-accent/30">{s.step}</div>
                <div>
                  <h4 className="font-bold text-ink">{s.title}</h4>
                  <p className="text-sm text-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
