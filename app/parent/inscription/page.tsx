import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/parent/auth/RegisterForm";
import { getOptionalParentSession } from "@/lib/auth/guards";
import { ensureInstalled } from "@/lib/auth/install-guard";

export const metadata: Metadata = {
  title: "Inscription parent — Royaume Magique des Multiplications",
};

export const dynamic = "force-dynamic";

export default async function ParentRegisterPage() {
  await ensureInstalled();
  const auth = await getOptionalParentSession();
  if (auth) redirect("/parent");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="font-display text-sm text-star">
        ← Royaume Magique des Multiplications
      </Link>
      <h1 className="font-display mt-6 text-3xl font-bold sm:text-4xl">
        Créer un compte parent
      </h1>
      <p className="mt-2 max-w-md text-center text-foreground-soft">
        Une adresse e-mail suffit. Aucune information sur votre enfant n&apos;est
        demandée ici.
      </p>
      <div className="mt-8 flex w-full justify-center">
        <RegisterForm />
      </div>
    </main>
  );
}
