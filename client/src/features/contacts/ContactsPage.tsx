import type { Contact } from "@kampus/shared";
import { Copy, Mail, Users } from "lucide-react";
import { errorMessage } from "../../api/client.ts";
import { useContacts } from "../../api/hooks.ts";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from "../../components/ui/index.ts";
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
    <li>
      <Card className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <Avatar firstName={contact.firstName} lastName={contact.lastName} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{name}</h2>
            <Badge tone="blue" className="mt-1 max-w-full whitespace-normal">
              {contact.title}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex-1 rounded-xl bg-surface p-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Talk to them about</h3>
          <p className="mt-1 text-sm text-text">{contact.helpsWith}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg text-sm font-medium break-all text-kampus-blue underline-offset-2 hover:underline"
          >
            <Mail aria-hidden className="size-4 shrink-0" />
            {contact.email}
          </a>
          <Button variant="secondary" size="sm" icon={<Copy aria-hidden className="size-4" />} onClick={copyEmail} aria-label={`Copy email of ${name}`}>
            Copy email
          </Button>
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
            description="Your campus team will show up here soon. Check again in a little while."
            action={
              <Button variant="secondary" size="sm" onClick={() => contacts.refetch()}>
                Check again
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contacts.data.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </ul>
      )}
    </>
  );
}
