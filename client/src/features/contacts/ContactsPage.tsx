import type { Contact } from "@kampus/shared";
import { Copy, Mail, Users } from "lucide-react";
import { errorMessage } from "../../api/client.ts";
import { useContacts } from "../../api/hooks.ts";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, useToast } from "../../components/ui/index.ts";
import { fullName } from "../../lib/format.ts";

function ContactCard({ contact }: { contact: Contact }) {
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
      <Card className="flex h-full flex-col p-5">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar firstName={contact.firstName} lastName={contact.lastName} size="lg" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold break-words">{name}</h2>
            <Badge tone="blue" className="mt-1 max-w-full whitespace-normal">
              {contact.title}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex-1 rounded-xl bg-surface p-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Talk to them about</h3>
          <p className="mt-1 text-sm text-text">{contact.helpsWith}</p>
        </div>

        {/* Email e botão de copiar sempre na mesma linha (o botão só com o ícone): antes, consoante o
            comprimento do email, uns cartões tinham-nos lado a lado e outros um por baixo do outro. */}
        <div className="mt-4 flex items-center gap-2">
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-lg text-sm font-medium break-all text-kampus-blue underline-offset-2 hover:underline"
          >
            <Mail aria-hidden className="size-4 shrink-0" />
            {contact.email}
          </a>
          <IconButton variant="secondary" size="sm" icon={<Copy aria-hidden />} onClick={copyEmail} label={`Copy email of ${name}`} />
        </div>
      </Card>
    </li>
  );
}

export function ContactsPage() {
  const contacts = useContacts();

  return (
    <>
      <PageHeader title="Staff contacts" description="Who to talk to, and what for." />

      {contacts.isPending ? (
        <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Loading staff contacts</span>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-60 rounded-[var(--radius-card)]" />
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
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contacts.data.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </ul>
      )}
    </>
  );
}
