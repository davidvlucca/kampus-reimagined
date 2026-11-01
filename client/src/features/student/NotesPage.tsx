import type { Note } from "@kampus/shared";
import { ArrowLeft, FileQuestion, NotebookPen, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useBlocker, useLocation, useNavigate, useParams } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors, isNotFound } from "../../api/client.ts";
import { useCreateNote, useDeleteNote, useNote, useNotes, useUpdateNote } from "../../api/hooks.ts";
import { Button, buttonClasses, Card, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Skeleton, SkeletonList, Textarea, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { formatDate, timeAgo } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { excerpt, noteChanges } from "./noteText.ts";

/** Estado passado ao navegar para uma nota acabada de criar (põe o foco no título). */
interface NoteLocationState {
  focusTitle?: boolean;
}

/** `/app/notes` e `/app/notes/:noteId`. No telemóvel mostra a lista OU o editor; em lg os dois lado a lado. */
export function NotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateNote();
  const lock = useSubmitLock();

  // Com a trava, um duplo clique em "New note" não cria duas "Untitled note".
  const newNote = () =>
    void lock(() =>
      create.mutateAsync({ title: "Untitled note", body: "" }).then(
        (note) => {
          toast({ title: "Note created", tone: "success" });
          navigate(`/app/notes/${note.id}`, { state: { focusTitle: true } satisfies NoteLocationState });
        },
        (e: unknown) => toast({ title: "Couldn't create the note", description: errorMessage(e), tone: "error" }),
      ),
    );

  return (
    <>
      <PageHeader
        title="Notes"
        description="Your own notes, saved to your account."
        className={cn(noteId && "max-lg:hidden")}
        actions={
          <Button onClick={newNote} loading={create.isPending} icon={<Plus aria-hidden className="size-4" />}>
            New note
          </Button>
        }
      />
      {noteId && (
        <div className="mb-4 lg:hidden">
          <h1 className="sr-only">Notes</h1>
          <Link to="/app/notes" className="inline-flex items-center gap-1 text-sm font-semibold text-kampus-blue hover:underline">
            <ArrowLeft aria-hidden className="size-4" />
            Back to notes
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section aria-label="All notes" className={cn(noteId && "max-lg:hidden")}>
          <NoteList selectedId={noteId} onCreate={newNote} creating={create.isPending} />
        </section>
        <section aria-label="Note editor" className={cn(!noteId && "max-lg:hidden")}>
          {noteId ? (
            <NoteEditor key={noteId} noteId={noteId} />
          ) : (
            <Card>
              <EmptyState icon={<NotebookPen aria-hidden />} title="Select a note or create a new one" description="Pick a note from the list to read or edit it." className="py-16" />
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

function NoteList({ selectedId, onCreate, creating }: { selectedId?: string; onCreate: () => void; creating: boolean }) {
  const notes = useNotes();
  if (notes.isPending) return <SkeletonList rows={4} label="Loading notes" />;
  if (notes.isError)
    return (
      <Card>
        <ErrorState message={errorMessage(notes.error)} onRetry={() => notes.refetch()} />
      </Card>
    );
  if (notes.data.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<NotebookPen aria-hidden />}
          title="No notes yet"
          description="Room numbers, names, wifi passwords: write down anything worth remembering."
          action={
            <Button size="sm" onClick={onCreate} loading={creating} icon={<Plus aria-hidden className="size-4" />}>
              Write your first note
            </Button>
          }
        />
      </Card>
    );
  return (
    <ul className="flex flex-col gap-2">
      {notes.data.map((note) => {
        const selected = note.id === selectedId;
        return (
          <li key={note.id}>
            <Link
              to={`/app/notes/${note.id}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-4 transition",
                selected ? "border-kampus-blue bg-kampus-blue-soft" : "border-line bg-card shadow-card hover:border-kampus-blue/40",
              )}
            >
              <span className="font-semibold break-words text-kampus-navy">{note.title}</span>
              <span className="text-xs text-muted">Edited {formatDate(note.updatedAt)}</span>
              {note.body.trim() && <span className="line-clamp-2 text-sm text-muted">{excerpt(note.body)}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NoteEditor({ noteId }: { noteId: string }) {
  const note = useNote(noteId);
  if (note.isPending)
    return (
      <Card className="flex flex-col gap-4 p-5" role="status">
        <span className="sr-only">Loading note</span>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-72 w-full" />
      </Card>
    );
  if (note.isError) {
    if (note.error instanceof ApiRequestError && note.error.status === 404)
      return (
        <Card>
          <EmptyState
            icon={<FileQuestion aria-hidden />}
            title="Note not found"
            description="It may have been deleted, or the link is wrong."
            action={
              <Link to="/app/notes" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Back to notes
              </Link>
            }
          />
        </Card>
      );
    return (
      <Card>
        <ErrorState message={errorMessage(note.error)} onRetry={() => note.refetch()} />
      </Card>
    );
  }
  return <NoteForm note={note.data} />;
}

function NoteForm({ note }: { note: Note }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  // `seed`: os valores com que o formulário começou (ou foi reposto). O "Unsaved changes" e o
  // que se envia ao guardar comparam com eles, não com a nota em cache, que pode mudar por baixo.
  const [seed, setSeed] = useState({ title: note.title, body: note.body });
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const lock = useSubmitLock();
  const focusTitle = (location.state as NoteLocationState | null)?.focusTitle === true;

  // Nota acabada de criar: foco no título, já selecionado para escrever por cima.
  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [focusTitle]);

  const dirty = title !== seed.title || body !== seed.body;

  // A nota mudou no servidor (refetch, guardada noutro separador) e aqui não há nada por
  // guardar: o formulário passa a mostrá-la. Com alterações por guardar, fica como está.
  if (!dirty && (note.title !== seed.title || note.body !== seed.body)) {
    setSeed({ title: note.title, body: note.body });
    setTitle(note.title);
    setBody(note.body);
  }

  // Sair com alterações por guardar pede confirmação (navegação na app e fechar o separador).
  const leavingAfterDelete = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !leavingAfterDelete.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () => {
    if (!dirty || update.isPending) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Give your note a title");
      titleRef.current?.focus();
      return;
    }
    setTitleError(undefined);
    // Só o que mudou: guardar o título num separador antigo já não repõe o corpo antigo.
    const changes = noteChanges(seed, title, body);
    if (Object.keys(changes).length === 0) {
      setTitle(seed.title);
      return;
    }
    const sent = { title, body };
    void lock(() =>
      update.mutateAsync({ id: note.id, ...changes }).then(
        (saved) => {
          setSeed({ title: saved.title, body: saved.body });
          // O que não foi mexido enquanto guardava passa a ser o que o servidor tem.
          setTitle((current) => (current === sent.title ? saved.title : current));
          setBody((current) => (current === sent.body ? saved.body : current));
          toast({ title: "Note saved", tone: "success" });
        },
        (e: unknown) => {
          // 404: apagada noutro separador; o hook volta a pedir a nota e o editor mostra "Note not found".
          if (!isNotFound(e)) setTitleError(fieldErrors(e).title);
          toast({ title: "Couldn't save the note", description: errorMessage(e), tone: "error" });
        },
      ),
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };
  // Ctrl/Cmd+S guarda (dentro do editor).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate className="flex flex-col gap-4 p-5">
        <Input ref={titleRef} label="Title" value={title} maxLength={120} error={titleError} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Note" value={body} maxLength={10_000} onChange={(e) => setBody(e.target.value)} className="min-h-72 lg:min-h-96" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-subtle" aria-live="polite">
            {dirty ? (
              <span className="font-medium text-warning">Unsaved changes</span>
            ) : (
              <>Last edited {timeAgo(note.updatedAt)}</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setDeleting(true)} icon={<Trash2 aria-hidden className="size-4" />} className="text-danger hover:bg-danger-soft">
              Delete
            </Button>
            <Button type="submit" disabled={!dirty} loading={update.isPending} icon={<Save aria-hidden className="size-4" />} aria-keyshortcuts="Control+S Meta+S">
              Save
            </Button>
          </div>
        </div>
      </form>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this note?"
        description={`"${note.title}" will be deleted for good.`}
        confirmLabel="Delete note"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(note.id);
            toast({ title: "Note deleted", tone: "success" });
            leavingAfterDelete.current = true;
            navigate("/app/notes", { replace: true });
          } catch (e) {
            toast({ title: "Couldn't delete the note", description: errorMessage(e), tone: "error" });
            // Já tinha sido apagada (noutro separador): sai do editor de uma nota que não existe.
            if (isNotFound(e)) {
              leavingAfterDelete.current = true;
              navigate("/app/notes", { replace: true });
            }
          }
        }}
      />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
        title="Discard your changes?"
        description="This note has unsaved changes. If you leave now, they'll be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => blocker.proceed?.()}
      />
    </Card>
  );
}
