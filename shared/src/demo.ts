// Contas partilhadas da demo pública. Qualquer visitante entra com elas, por isso ninguém
// as pode apagar nem mudar o email ou a password (senão a demo deixava de funcionar para
// os visitantes seguintes). O nome pode mudar: a reposição diária volta a pô-lo.
export const PROTECTED_DEMO_EMAILS = ["staff@example.com", "student@example.com"] as const;

/** A password de todas as contas do seed (está no ecrã de login: a demo é pública). */
export const DEMO_PASSWORD = "Kampus123";

export function isProtectedDemoEmail(email: string): boolean {
  return (PROTECTED_DEMO_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

export const DEMO_ACCOUNT_MESSAGES = {
  delete: "This is the shared demo account, so it can't be deleted.",
  credentials: "This is the shared demo account, so its email and password can't be changed.",
  ownPassword: "This is a shared demo account, so its password can't be changed.",
} as const;
