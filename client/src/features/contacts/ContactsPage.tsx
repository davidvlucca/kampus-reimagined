import type { Contact } from "@kampus/shared";
import { ArrowRight, Building2, Copy, Mail, MessageCircle, Star, Users } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "../../api/client.ts";
import { useContacts, useCurrentUser } from "../../api/hooks.ts";
import { Avatar, Badge, Button, buttonClasses, Card, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName } from "../../lib/format.ts";
import { groupContacts, isProgramManager } from "./contactGroups.ts";

const grid = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

function ContactCard({ contact, startHere }: { contact: Contact; startHere: boolean }) {
  const toast = useToast();
  const name = fullName(contact);

  const copyEmail = async () => {
    try {
      if (!navigator.clipboard) throw new Error("No clipboard");
      await navigator.clipboard.writeText(contact.email);
      toast({ title: "Email copied", description: contact.email });
    } catch {
      toast({ title: "Couldn't copy the email", description: "Select it and copy it by hand.", tone: "error" });
    }
  };

  return (
    // min-w-0: sem ele, um email comprido alargava a coluna da grelha para fora do ecrã.
    <li className="min-w-0">
      <Card className={cn("flex h-full flex-col p-5", startHere && "border-kampus-blue/60")}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar firstName={contact.firstName} lastName={contact.lastName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-lg font-semibold break-words">{name}</h3>
              {startHere && (
                <Badge tone="blue" icon={<Star aria-hidden />} className="border-kampus-navy bg-kampus-navy text-white">
                  Start here
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium break-words text-kampus-blue">{contact.title}</p>
          </div>
        </div>

        {/* Só o que a API tem: o texto de ajuda de cada pessoa do staff (sem horários nem sala, que não existem). */}
        {contact.helpsWith && (
          <div className="mt-4 rounded-xl border border-line bg-surface p-4">
            <h4 className="text-xs font-semibold text-muted">Ask me about</h4>
            <p className="mt-1 text-sm text-text">{contact.helpsWith}</p>
          </div>
        )}

        <p className="mt-4 flex min-w-0 items-center gap-2 text-sm text-text">
          <Mail aria-hidden className="size-4 shrink-0 text-muted" />
          <span className="min-w-0 break-all">{contact.email}</span>
        </p>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <a
            href={`mailto:${contact.email}`}
            className={buttonClasses({ variant: startHere ? "primary" : "secondary", className: "min-w-0 px-3" })}
          >
            <Mail aria-hidden className="size-4 shrink-0" />
            Email {contact.firstName}
          </a>
          <Button variant="secondary" icon={<Copy aria-hidden className="size-4" />} onClick={copyEmail} aria-label={`Copy email of ${name}`} className="min-w-0 px-3">
            Copy email
          </Button>
        </div>
      </Card>
    </li>
  );
}

function GroupHeading({ id, icon, title, description }: { id: string; icon: ReactNode; title: string; description: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue [&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

/** O fecho da página: na dúvida, falar com a Program Manager. */
function NotSureTile({ manager }: { manager: Contact }) {
  return (
    <li className="min-w-0">
      <div className="flex h-full flex-col justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue">
          <MessageCircle aria-hidden className="size-5" />
        </span>
        <h3 className="mt-3 text-base font-semibold">Not sure who to ask?</h3>
        <p className="mt-1 text-sm text-text">
          Ask {manager.firstName}, your {manager.title}. You'll be pointed to the right person, even on your first day.
        </p>
        <a href={`mailto:${manager.email}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-kampus-blue hover:underline">
          Email {manager.firstName}
          <ArrowRight aria-hidden className="size-4" />
        </a>
      </div>
    </li>
  );
}

export function ContactsPage() {
  const contacts = useContacts();
  const user = useCurrentUser();

  return (
    <>
      <PageHeader title="Your team" description="The people who will help you settle in. Say hi before day 1, they are expecting you." />

      {contacts.isPending ? (
        <div role="status" className={grid}>
          <span className="sr-only">Loading your team</span>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : contacts.isError ? (
        <Card>
          <ErrorState message={errorMessage(contacts.error)} onRetry={() => contacts.refetch()} />
        </Card>
      ) : contacts.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users aria-hidden />}
            title="No staff contacts yet"
            description="Your campus team will show up here once staff add them."
            action={
              <Button variant="secondary" size="sm" onClick={() => contacts.refetch()}>
                Check again
              </Button>
            }
          />
        </Card>
      ) : (
        <TeamGroups contacts={contacts.data} cohortName={user.cohort?.name} />
      )}
    </>
  );
}

function TeamGroups({ contacts, cohortName }: { contacts: Contact[]; cohortName?: string }) {
  const { cohort, campus } = groupContacts(contacts);
  const manager = cohort.find(isProgramManager);
  const groups = [
    { key: "cohort", items: cohort, icon: <Users aria-hidden />, title: "Your cohort team", description: cohortName ?? "The people who teach and run your program" },
    { key: "campus", items: campus, icon: <Building2 aria-hidden />, title: "Campus", description: "For every cohort on campus" },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group, i) => (
        <section key={group.key} aria-labelledby={`team-${group.key}`}>
          <GroupHeading id={`team-${group.key}`} icon={group.icon} title={group.title} description={group.description} />
          <ul className={grid}>
            {group.items.map((contact) => (
              <ContactCard key={contact.id} contact={contact} startHere={contact === manager} />
            ))}
            {/* O fecho vai no fim do último grupo. */}
            {manager && i === groups.length - 1 && <NotSureTile manager={manager} />}
          </ul>
        </section>
      ))}
    </div>
  );
}
