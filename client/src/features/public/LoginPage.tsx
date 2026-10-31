import type { Portal } from "@kampus/shared";
import { PageHeader } from "../../components/ui/index.ts";

// Página por construir (subagente D).
export function LoginPage({ portal }: { portal: Portal }) {
  return <PageHeader title={portal === "staff" ? "Staff login" : "Student login"} />;
}
