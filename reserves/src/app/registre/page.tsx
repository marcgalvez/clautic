import Link from "next/link";
import { getT } from "@/lib/i18n";
import { registerAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { Checkbox, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { env } from "@/lib/env";

export const metadata = { title: "Registre" };

export default async function Register() {
  const { t, locale } = await getT();
  const host = env().APP_URL.replace(/^https?:\/\//, "");
  return (
    <AuthShell title={t.auth.registerTitle} intro={t.auth.registerIntro} locale={locale} footer={<>{t.auth.haveAccount} <Link className="font-semibold text-accent underline" href="/login">{t.auth.login}</Link></>}>
      <ActionForm action={registerAction}>
        <Field label={t.auth.businessName} htmlFor="businessName">
          <input id="businessName" name="businessName" required minLength={2} maxLength={80} className="input" />
        </Field>
        <Field label={t.auth.slug} htmlFor="slug" hint={`${host}/reserves/…`}>
          <input id="slug" name="slug" required minLength={3} maxLength={48} pattern="[a-zA-Z0-9\-]+" placeholder="perruqueria-maria" className="input" />
        </Field>
        <Field label={t.auth.yourName} htmlFor="name">
          <input id="name" name="name" required autoComplete="name" className="input" />
        </Field>
        <Field label={t.common.email} htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </Field>
        <Field label={`${t.common.phone} (${t.common.optional})`} htmlFor="phone">
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
        </Field>
        <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint}>
          <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="input" />
        </Field>
        <Checkbox name="terms" required label={t.auth.acceptTerms} />
        <SubmitButton className="btn-primary w-full">{t.auth.register}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
