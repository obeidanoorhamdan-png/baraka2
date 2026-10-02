import { Layout } from "@/components/Layout";
import { FamilyLookup } from "@/components/FamilyLookup";
import { ShieldCheck, LockKeyhole } from "lucide-react";

const Auth = () => (
  <Layout>
    <section className="container max-w-5xl py-8 sm:py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">تدقيق بيانات الأسرة</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          أدخل رقم هوية رب الأسرة أو أحد أفرادها لعرض الملف المسجل كاملاً.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
          <LockKeyhole className="h-3.5 w-3.5" /> عرض آمن فقط، دون كلمة مرور أو صلاحية تعديل
        </p>
      </div>
      <FamilyLookup expanded />
    </section>
  </Layout>
);

export default Auth;
