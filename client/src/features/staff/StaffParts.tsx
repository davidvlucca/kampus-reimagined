import { Bell, Send } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, buttonClasses, type BadgeTone } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { STATUS_LABEL, type StudentStatus } from "./progress.ts";

// Peças partilhadas pelas três páginas do staff: o estado do aluno e os lembretes.

const STATUS_TONE: Record<StudentStatus, BadgeTone> = {
  not_signed_in: "danger",
  behind: "warning",
  on_track: "blue",
  ready: "success",
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/**
 * Um lembrete é um link mailto: abre o programa de email de quem está no staff, com o texto
 * já escrito. Não há envio pelo servidor (nem endereços a sair da app).
 */
export function MailLink({
  href,
  children,
  variant = "secondary",
  size = "md",
  icon = "bell",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  icon?: "bell" | "send";
  className?: string;
}) {
  const Icon = icon === "bell" ? Bell : Send;
  return (
    <a href={href} className={buttonClasses({ variant, size, className: cn("min-h-11", className) })}>
      <Icon aria-hidden className="size-4" />
      {children}
    </a>
  );
}
