import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth/session";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Login" };

export default async function Login() {
  const user = await getCurrentUser();
  if (user) redirect(user.isSuperAdmin ? "/admin" : "/panell");
  const { t, locale } = await getT();
  return (
    <AuthShell title={t.auth.loginTitle} locale={locale} footer={<>{t.auth.noAccount} <Link className="font-semibold text-accent underline" href="/registre">{t.landing.cta}</Link></>}>
      <ActionForm action={loginAction}>
        <Field label={t.common.email} htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </Field>
        <Field label={t.auth.password} htmlFor="password">
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </Field>
        <SubmitButton className="btn-primary w-full">{t.auth.login}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
