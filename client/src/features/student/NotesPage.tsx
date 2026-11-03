import type { Note } from "@kampus/shared";
import { ArrowLeft, FileQuestion, History, NotebookPen, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useBlocker, useLocation, useNavigate, useParams } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors, isNotFound } from "../../api/client.ts";
import { useCreateNote, useDeleteNote, useNote, useNotes, useUpdateNote } from "../../api/hooks.ts";
import { Button, buttonClasses, Card, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Skeleton, SkeletonList, Textarea, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { editedAt } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { clearDraft, loadDraft, saveDraft } from "./noteDraft.ts";
import { excerpt, noteChanges } from "./noteText.ts";

const NEW_NOTE_TITLE = "Untitled note";
const BODY_MAX = 10_000;
// A partir daqui mostra-se a contagem: o maxLength cortava o texto sem aviso nenhum.
const BODY_WARN_AT = 9_000;
const count = new Intl.NumberFormat("en-GB");

/** As notas com o editor aberto agora (ver a limpeza das notas novas vazias no NoteForm). */
const openEditors = new Set<string>();

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
      create.mutateAsync({ title: NEW_NOTE_TITLE, body: "" }).then(
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
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
              <span className="clip-marks font-semibold break-words text-kampus-navy">{note.title}</span>
              <span className="text-xs text-muted">Edited {editedAt(note.updatedAt)}</span>
              {note.body.trim() && <span className="line-clamp-2 text-sm break-words text-muted">{excerpt(note.body)}</span>}
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
          <OrphanDraft noteId={noteId} />
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

/** "1,000 characters left"... só nos patamares (9 000, 9 500, 9 900, 10 000), para o leitor de ecrã. */
function limitMessage(length: number): string {
  if (length >= BODY_MAX) return "Character limit reached";
  for (const left of [100, 500, 1_000]) if (BODY_MAX - length <= left) return `${count.format(left)} characters left`;
  return "";
}

/** A nota já não existe, mas há texto por guardar dela neste separador: oferece-o como nota nova. */
function OrphanDraft({ noteId }: { noteId: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateNote();
  const lock = useSubmitLock();
  const [draft, setDraft] = useState(() => loadDraft(noteId));
  if (!draft) return null;
  const saveAsNew = () =>
    void lock(() =>
      create.mutateAsync({ title: draft.title.trim() || NEW_NOTE_TITLE, body: draft.body }).then(
        (note) => {
          clearDraft(noteId);
          toast({ title: "Saved as a new note", tone: "success" });
          navigate(`/app/notes/${note.id}`, { replace: true });
        },
        (e: unknown) => toast({ title: "Couldn't save the note", description: errorMessage(e), tone: "error" }),
      ),
    );
  return (
    <div role="status" className="m-5 mb-0 flex flex-col gap-3 rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft p-4 text-sm text-kampus-navy">
      <p>This note was deleted, but your unsaved changes to "{draft.title.trim() || NEW_NOTE_TITLE}" are still here.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={saveAsNew} loading={create.isPending} icon={<Save aria-hidden className="size-4" />}>
          Save as a new note
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearDraft(noteId);
            setDraft(null);
          }}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

function NoteForm({ note }: { note: Note }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  // `seed`: os valores com que o formulário começou (ou foi reposto). O "Unsaved changes" e o
  // que se envia ao guardar comparam com eles, não com a nota em cache, que pode mudar por baixo.
  // Um rascunho deste separador (sessão expirada, recarregar) volta ao formulário, se ainda for diferente.
  const [draft] = useState(() => {
    const saved = loadDraft(note.id);
    return saved && (saved.title !== note.title || saved.body !== note.body) ? saved : null;
  });
  const [restored, setRestored] = useState(draft !== null);
  const [seed, setSeed] = useState(draft?.seed ?? { title: note.title, body: note.body });
  const [title, setTitle] = useState(draft?.title ?? note.title);
  const [body, setBody] = useState(draft?.body ?? note.body);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const leavingAfterDelete = useRef(false);
  const lock = useSubmitLock();
  const focusTitle = (location.state as NoteLocationState | null)?.focusTitle === true;

  // Nota acabada de criar: foco no título, já selecionado para escrever por cima.
  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [focusTitle]);

  const dirty = title !== seed.title || body !== seed.body;

  // O rascunho acompanha o que está por guardar; sem nada por guardar, sai.
  useEffect(() => {
    if (dirty) saveDraft(note.id, { title, body, seed });
    else clearDraft(note.id);
  }, [dirty, note.id, title, body, seed]);

  // O separador com o nome da nota (todas as notas eram "Notes · Kampus").
  useEffect(() => {
    document.title = `${note.title} · Kampus`;
    return () => {
      document.title = "Notes · Kampus";
    };
  }, [note.title]);

  // "New note" cria logo a nota (é o que dá o URL). Se o aluno sai sem lhe mexer, apaga-se,
  // senão juntavam-se notas "Untitled note" vazias. Só as criadas aqui, e só sem nada por guardar.
  const untouched = focusTitle && !dirty && seed.title === NEW_NOTE_TITLE && seed.body === "" && note.title === NEW_NOTE_TITLE && note.body === "";
  const leaveRef = useRef({ untouched, remove: remove.mutate });
  useEffect(() => {
    leaveRef.current = { untouched, remove: remove.mutate };
  });
  useEffect(() => {
    const id = note.id;
    openEditors.add(id);
    return () => {
      openEditors.delete(id);
      const { untouched: empty, remove: removeNote } = leaveRef.current;
      // Adiado: no StrictMode o efeito desmonta e volta a montar logo (isso não é sair da nota).
      if (empty && !leavingAfterDelete.current) window.setTimeout(() => !openEditors.has(id) && removeNote(id), 0);
    };
  }, [note.id]);

  // A nota mudou no servidor (refetch, guardada noutro separador) e aqui não há nada por
  // guardar: o formulário passa a mostrá-la. Com alterações por guardar, fica como está.
  if (!dirty && (note.title !== seed.title || note.body !== seed.body)) {
    setSeed({ title: note.title, body: note.body });
    setTitle(note.title);
    setBody(note.body);
  }

  // Sair com alterações por guardar pede confirmação (navegação na app e fechar o separador).
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
          flushSync(() => {
            setSeed({ title: saved.title, body: saved.body });
            // O que não foi mexido enquanto guardava passa a ser o que o servidor tem.
            setTitle((current) => (current === sent.title ? saved.title : current));
            setBody((current) => (current === sent.body ? saved.body : current));
            setRestored(false);
          });
          // O Save fica desativado depois de guardar e o foco caía no <body>: passa para o estado.
          const active = document.activeElement;
          if (!active || active === document.body || (active instanceof HTMLButtonElement && active.type === "submit")) statusRef.current?.focus();
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

  // Volta ao que está guardado (e esquece o rascunho).
  const discardRestored = () => {
    clearDraft(note.id);
    setSeed({ title: note.title, body: note.body });
    setTitle(note.title);
    setBody(note.body);
    setRestored(false);
    titleRef.current?.focus();
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
        {restored && dirty && (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft px-4 py-3 text-sm text-kampus-navy">
            <History aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">Restored unsaved changes from earlier. Save to keep them.</span>
            <Button variant="ghost" size="sm" onClick={discardRestored}>
              Discard them
            </Button>
          </div>
        )}
        <Input ref={titleRef} label="Title" value={title} maxLength={120} error={titleError} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          label="Note"
          value={body}
          maxLength={BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-72 lg:min-h-96"
          hint={body.length > BODY_WARN_AT ? `${count.format(body.length)} / ${count.format(BODY_MAX)} characters` : undefined}
        />
        {/* Anuncia só ao passar cada patamar, não a cada tecla. */}
        <p aria-live="polite" className="sr-only">
          {limitMessage(body.length)}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p ref={statusRef} tabIndex={-1} className="text-sm text-subtle outline-none" aria-live="polite">
            {dirty ? (
              <span className="font-medium text-warning">Unsaved changes</span>
            ) : (
              <>Last edited {editedAt(note.updatedAt)}</>
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
            clearDraft(note.id);
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
        onConfirm={() => {
          clearDraft(note.id);
          blocker.proceed?.();
        }}
      />
    </Card>
  );
}
