import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/parent/auth/LoginForm";
import { getOptionalParentSession } from "@/lib/auth/guards";
import { ensureInstalled } from "@/lib/auth/install-guard";

export const metadata: Metadata = {
  title: "Connexion parent — Royaume Magique des Multiplications",
};

export const dynamic = "force-dynamic";

export default async function ParentLoginPage() {
  await ensureInstalled();
  const auth = await getOptionalParentSession();
  if (auth) redirect("/parent");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="font-display text-sm text-star">
        ← Royaume Magique des Multiplications
      </Link>
      <h1 className="font-display mt-6 text-3xl font-bold sm:text-4xl">
        Espace parent
      </h1>
      <p className="mt-2 text-foreground-soft">
        Connectez-vous pour suivre l&apos;aventure de votre enfant.
      </p>
      <div className="mt-8 flex w-full justify-center">
        <LoginForm />
      </div>
    </main>
  );
}
