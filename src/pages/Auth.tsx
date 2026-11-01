import { Layout } from "@/components/Layout";
import { FamilySignIn } from "@/components/family/FamilySignIn";
import { ShieldCheck } from "lucide-react";

const Auth = () => (
  <Layout>
    <section className="container max-w-lg py-8 sm:py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">بركة 2 — حساب الأسرة</h1>
      </div>
      <FamilySignIn />
    </section>
  </Layout>
);

export default Auth;
