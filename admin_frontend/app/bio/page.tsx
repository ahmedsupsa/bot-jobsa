import Image from "next/image";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "روابط Jobbots",
  description: "التقديم التلقائي على الوظائف",
};

export default function BioPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        {/* الهوية والقيمة المضافة */}
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto bg-ink rounded-full flex items-center justify-center">
            <Image src="/logo-transparent.png" alt="Jobbots" width={36} height={36} className="block" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Jobbots</h1>
            <p className="text-accent text-sm font-semibold mt-1">وفّر وقتك، واترك الذكاء الاصطناعي يقدّم عنك!</p>
          </div>
        </div>

        {/* الأزرار */}
        <div className="space-y-4 pt-4">
          <a
            href="https://www.jobbots.org/store"
            className="flex items-center justify-center gap-3 w-full bg-accent hover:opacity-90 text-accent-fg font-bold py-4 rounded-xl transition-all shadow-lg shadow-accent/20"
          >
            <ShoppingBag size={20} /> اشترك الآن وابدأ التقديم
          </a>
          <a
            href="https://wa.me/966560766880"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-4 rounded-xl transition-all shadow-md"
          >
            <MessageCircle size={20} /> استفسر عبر واتساب
          </a>
        </div>

        {/* دليل اجتماعي */}
        <div className="pt-6 border-t border-line mt-6">
          <p className="text-[11px] text-muted font-medium">تقديم تلقائي ذكي — كل 30 دقيقة بلا جهد منك</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
