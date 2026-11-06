import { cleanNoteBody, NEW_NOTE_TITLE, type Note } from "@kampus/shared";
import { AlertCircle, ArrowLeft, CheckCircle2, Ellipsis, FileQuestion, History, LoaderCircle, NotebookPen, Plus, Save, Search, SearchX, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, useBlocker, useLocation, useNavigate, useParams } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors, isNotFound } from "../../api/client.ts";
import { useCreateNote, useCurrentUser, useDeleteNote, useDiscardEmptyNote, useNote, useNotes, useUpdateNote } from "../../api/hooks.ts";
import { Button, buttonClasses, Card, ConfirmDialog, EmptyState, ErrorState, Input, Menu, PageHeader, Skeleton, SkeletonList, Textarea, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { editedAt } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { clearDraft, loadDraft, saveDraft } from "./noteDraft.ts";
import { excerpt, matchesNote, noteChanges } from "./noteText.ts";

const BODY_MAX = 10_000;
// Guarda sozinho quando se pára de escrever este tempo (e logo ao sair do campo ou da nota).
const AUTOSAVE_MS = 800;
const count = new Intl.NumberFormat("en-GB");

/** As notas com o editor aberto agora (ver a limpeza das notas novas vazias no NoteForm). */
const openEditors = new Set<string>();

/** Estado passado ao navegar para uma nota acabada de criar (põe o foco no título). */
interface NoteLocationState {
  focusTitle?: boolean;
}

const backLink = "inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-kampus-navy hover:underline";

/** No telemóvel o editor é um ecrã à parte: este link volta à lista. */
function AllNotesLink({ className }: { className?: string }) {
  return (
    <Link to="/app/notes" className={cn(backLink, className)}>
      <ArrowLeft aria-hidden className="size-4" />
      All notes
    </Link>
  );
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
          <Button onClick={newNote} loading={create.isPending} icon={<Plus aria-hidden className="size-4" />} className="max-sm:w-full">
            New note
          </Button>
        }
      />
      {noteId && <h1 className="sr-only lg:hidden">Notes</h1>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start">
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
  const [query, setQuery] = useState("");
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
  // A pesquisa é só no browser: as notas já estão todas na cache.
  const shown = query.trim() ? notes.data.filter((n) => matchesNote(n, query)) : notes.data;
  const total = notes.data.length;
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        label="Search notes"
        hideLabel
        placeholder="Search notes"
        leadingIcon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <p className="text-sm text-muted" aria-live="polite">
        {shown.length === total ? `${total} ${total === 1 ? "note" : "notes"}` : `${shown.length} of ${total} notes`}
      </p>
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX aria-hidden />}
            title="No notes match your search"
            description="Try another word, or clear the search to see all your notes."
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
            className="py-8"
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((note) => {
            const selected = note.id === selectedId;
            return (
              <li key={note.id}>
                <Link
                  to={`/app/notes/${note.id}`}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-4 transition",
                    selected
                      ? "border-kampus-blue/50 bg-kampus-blue-soft shadow-[inset_3px_0_0_var(--color-kampus-blue)]"
                      : "border-line bg-card shadow-card hover:border-kampus-blue/40",
                  )}
                >
                  <span className="clip-marks font-display font-semibold break-words text-kampus-navy">{note.title}</span>
                  {note.body.trim() && <span className="line-clamp-2 text-sm break-words text-text">{excerpt(note.body)}</span>}
                  <span className="text-xs text-muted">Edited {editedAt(note.updatedAt)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoteEditor({ noteId }: { noteId: string }) {
  const note = useNote(noteId);
  if (note.isPending)
    return (
      <>
        <AllNotesLink className="mb-2 lg:hidden" />
        <Card className="flex flex-col gap-4 p-5" role="status">
          <span className="sr-only">Loading note</span>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-72 w-full" />
        </Card>
      </>
    );
  if (note.isError) {
    if (note.error instanceof ApiRequestError && note.error.status === 404)
      return (
        <>
          <AllNotesLink className="mb-2 lg:hidden" />
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
        </>
      );
    return (
      <>
        <AllNotesLink className="mb-2 lg:hidden" />
        <Card>
          <ErrorState message={errorMessage(note.error)} onRetry={() => note.refetch()} />
        </Card>
      </>
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
  const userId = useCurrentUser().id;
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateNote();
  const lock = useSubmitLock();
  const [draft, setDraft] = useState(() => loadDraft(userId, noteId));
  if (!draft) return null;
  const saveAsNew = () =>
    void lock(() =>
      create.mutateAsync({ title: draft.title.trim() || NEW_NOTE_TITLE, body: draft.body }).then(
        (note) => {
          clearDraft(userId, noteId);
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
            clearDraft(userId, noteId);
            setDraft(null);
          }}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

/** Volta a desenhar de 30 em 30 segundos (o "edited 3 minutes ago" não fica parado). */
function useTick(ms = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

type Seed = { title: string; body: string };

function NoteForm({ note }: { note: Note }) {
  const userId = useCurrentUser().id;
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const discardEmpty = useDiscardEmptyNote();
  useTick();
  // `seed`: o que o servidor tem (o que o formulário recebeu ou guardou por último). O que se
  // envia ao guardar compara com ele, não com a nota em cache, que pode mudar por baixo.
  // Um rascunho deste separador (sessão expirada, recarregar) volta ao formulário, se ainda for diferente.
  const [draft] = useState(() => {
    const saved = loadDraft(userId, note.id);
    return saved && (saved.title !== note.title || saved.body !== note.body) ? saved : null;
  });
  // Um rascunho reposto não se guarda sozinho: pode ser mais velho do que o que está no servidor.
  // Guarda-se quando o aluno escreve, ou carrega em "Keep them".
  const [restored, setRestored] = useState(draft !== null);
  const [seed, setSeedState] = useState<Seed>(draft?.seed ?? { title: note.title, body: note.body });
  const [title, setTitle] = useState(draft?.title ?? note.title);
  // Um rascunho de antes da limpeza dos caracteres de controlo: sem ela, nunca batia certo com o gravado.
  const [body, setBody] = useState(draft ? cleanNoteBody(draft.body) : note.body);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  // O que o leitor de ecrã ouve: só "guardado" ou o erro, uma vez por gravação (não a cada tecla).
  const [announcement, setAnnouncement] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const leavingAfterDelete = useRef(false);
  const focusTitle = (location.state as NoteLocationState | null)?.focusTitle === true;

  // Refs para o guardar automático: o temporizador e o blocker correm fora do render.
  const seedRef = useRef(seed);
  const valuesRef = useRef({ title, body });
  const inflight = useRef<Promise<boolean> | null>(null);
  const setSeed = (next: Seed) => {
    seedRef.current = next;
    setSeedState(next);
  };

  // Nota acabada de criar: foco no título, já selecionado para escrever por cima.
  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [focusTitle]);

  // O título compara-se sem espaços à volta (é assim que a API o guarda): um espaço no fim,
  // a meio de escrever, não é uma alteração nem é cortado pelo guardar automático.
  const dirty = title.trim() !== seed.title || body !== seed.body;

  // O rascunho acompanha o que está por guardar; sem nada por guardar, sai.
  useEffect(() => {
    if (dirty) saveDraft(userId, note.id, { title, body, seed });
    else clearDraft(userId, note.id);
  }, [dirty, userId, note.id, title, body, seed]);

  // O separador com o nome da nota (todas as notas eram "Notes · Kampus").
  useEffect(() => {
    document.title = `${note.title} · Kampus`;
    return () => {
      document.title = "Notes · Kampus";
    };
  }, [note.title]);

  // "New note" cria logo a nota (é o que dá o URL). Se o aluno sai sem lhe mexer, apaga-se,
  // senão juntavam-se notas "Untitled note" vazias. Só as criadas aqui, e só sem nada por guardar.
  // A cache deste separador pode estar atrasada (outro separador já lhe escreveu): por isso o
  // DELETE é condicional e é o servidor que decide se ainda está vazia.
  const untouched = focusTitle && !dirty && seed.title === NEW_NOTE_TITLE && seed.body === "" && note.title === NEW_NOTE_TITLE && note.body === "";
  const leaveRef = useRef({ untouched, discard: discardEmpty.mutate });
  useEffect(() => {
    leaveRef.current = { untouched, discard: discardEmpty.mutate };
  });
  useEffect(() => {
    const id = note.id;
    openEditors.add(id);
    return () => {
      openEditors.delete(id);
      const { untouched: empty, discard } = leaveRef.current;
      // Adiado: no StrictMode o efeito desmonta e volta a montar logo (isso não é sair da nota).
      if (empty && !leavingAfterDelete.current) window.setTimeout(() => !openEditors.has(id) && discard(id), 0);
    };
  }, [note.id]);

  // A nota mudou no servidor (refetch, guardada noutro separador) e aqui não há nada por
  // guardar: o formulário passa a mostrá-la. Com alterações por guardar, fica como está.
  if (!dirty && (note.title !== seed.title || note.body !== seed.body)) {
    setSeedState({ title: note.title, body: note.body });
    setTitle(note.title);
    setBody(note.body);
  }

  /**
   * Guarda o que estiver por guardar. `true` se no fim não fica nada por guardar.
   * Com uma gravação a meio, espera por ela e manda só o que mudou entretanto.
   */
  const saveNow = async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (leavingAfterDelete.current) return true;
    const { title: t, body: b } = valuesRef.current;
    const changes = noteChanges(seedRef.current, t, b);
    if (Object.keys(changes).length === 0) return true;
    if (!t.trim()) {
      setTitleError("Give your note a title");
      return false;
    }
    setTitleError(undefined);
    const run = update.mutateAsync({ id: note.id, ...changes }).then(
      (saved) => {
        setSeed({ title: saved.title, body: saved.body });
        setRestored(false);
        setSaveError(null);
        // O texto muda sempre um pouco: um anúncio igual ao anterior não volta a ser lido.
        setAnnouncement((prev) => (prev === "Note saved" ? "Note saved." : "Note saved"));
        return true;
      },
      (e: unknown) => {
        // 404: apagada noutro separador; o hook volta a pedir a nota e o editor mostra "Note not found".
        if (!isNotFound(e)) {
          const fields = fieldErrors(e);
          if (fields.title) setTitleError(fields.title);
        }
        setSaveError(errorMessage(e));
        setAnnouncement(`Couldn't save the note. ${errorMessage(e)}`);
        return false;
      },
    );
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  };
  const saveRef = useRef(saveNow);

  // Guardar automático: 800 ms depois da última tecla. Um rascunho reposto espera pelo aluno.
  useEffect(() => {
    if (!dirty || restored) return;
    const id = window.setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [dirty, restored, title, body]);

  // Separador escondido (mudar de app no telemóvel, fechar): guarda já, sem esperar.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && !restored && void saveRef.current();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [restored]);

  // Sair da nota com alterações por guardar: guarda primeiro e só depois sai. Se não der
  // (sem título, erro da API), pergunta se quer descartar.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !leavingAfterDelete.current && currentLocation.pathname !== nextLocation.pathname,
  );
  const blockerRef = useRef(blocker);
  // Os refs acompanham o último render (o seed também muda nos handlers, logo ao guardar).
  useLayoutEffect(() => {
    seedRef.current = seed;
    valuesRef.current = { title, body };
    saveRef.current = saveNow;
    blockerRef.current = blocker;
  });
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let cancelled = false;
    const attempt = restored ? Promise.resolve(false) : saveRef.current();
    void attempt.then((ok) => {
      if (cancelled) return;
      if (ok) blockerRef.current.proceed?.();
      else setAskLeave(true);
    });
    return () => {
      cancelled = true;
    };
  }, [blocker.state, restored]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Volta ao que está guardado (e esquece o rascunho).
  const discardRestored = () => {
    clearDraft(userId, note.id);
    setSeed({ title: note.title, body: note.body });
    setTitle(note.title);
    setBody(note.body);
    setRestored(false);
    titleRef.current?.focus();
  };

  const keepRestored = () => {
    setRestored(false);
    void saveRef.current();
  };

  // Escrever é aceitar o rascunho reposto (passa a guardar-se sozinho).
  const edit = (field: "title" | "body", value: string) => {
    if (field === "title") {
      setTitle(value);
      if (titleError && value.trim()) setTitleError(undefined);
    } else setBody(cleanNoteBody(value));
    if (restored) setRestored(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void saveNow();
  };
  // Ctrl/Cmd+S guarda já (dentro do editor), sem esperar pelo temporizador.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (restored) setRestored(false);
      void saveNow();
    }
  };
  const onBlurField = () => {
    if (!restored) void saveNow();
  };

  const status = (
    <SaveStatus
      dirty={dirty}
      restored={restored}
      titleMissing={!title.trim()}
      error={saveError}
      editedAt={editedAt(note.updatedAt)}
      onRetry={() => void saveNow()}
    />
  );

  return (
    <Card className="max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
      <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate className="flex flex-col gap-4 lg:p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <AllNotesLink className="lg:hidden" />
            <div className="min-w-0 max-lg:hidden">{status}</div>
            <Menu
              label="Note actions"
              icon={<Ellipsis aria-hidden />}
              items={[{ label: "Delete note", icon: <Trash2 aria-hidden />, tone: "danger", onSelect: () => setDeleting(true) }]}
            />
          </div>
          <div className="lg:hidden">{status}</div>
        </div>
        {/* Anuncia "guardado" ou o erro uma vez por gravação, não a cada tecla. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {restored && dirty && (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft px-4 py-3 text-sm text-kampus-navy">
            <History aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">Restored unsaved changes from earlier.</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={keepRestored}>
                Keep them
              </Button>
              <Button variant="ghost" size="sm" onClick={discardRestored}>
                Discard them
              </Button>
            </div>
          </div>
        )}
        <Input
          ref={titleRef}
          label="Title"
          value={title}
          maxLength={120}
          error={titleError}
          onChange={(e) => edit("title", e.target.value)}
          onBlur={onBlurField}
          className="h-13 font-display text-xl font-semibold text-kampus-navy"
        />
        <Textarea
          label="Note"
          value={body}
          maxLength={BODY_MAX}
          onChange={(e) => {
            const el = e.target;
            const clean = cleanNoteBody(el.value);
            edit("body", el.value);
            // Colar a meio texto com caracteres que saem: o cursor ficava no fim. Volta para depois do colado.
            if (clean !== el.value) {
              const caret = cleanNoteBody(el.value.slice(0, el.selectionEnd)).length;
              requestAnimationFrame(() => el.setSelectionRange(caret, caret));
            }
          }}
          onBlur={onBlurField}
          className="min-h-[50dvh] lg:min-h-[28rem]"
          hint={
            <span className="flex flex-wrap justify-between gap-x-3">
              <span>Changes save as you type.</span>
              <span className={cn("tabular-nums", body.length >= BODY_MAX && "font-semibold text-warning")}>
                {count.format(body.length)} / {count.format(BODY_MAX)}
              </span>
            </span>
          }
        />
        {/* Anuncia só ao passar cada patamar, não a cada tecla. */}
        <p aria-live="polite" className="sr-only">
          {limitMessage(body.length)}
        </p>
      </form>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this note?"
        description={`"${note.title}" will be deleted for good.`}
        confirmLabel="Delete note"
        onConfirm={async () => {
          try {
            leavingAfterDelete.current = true;
            await remove.mutateAsync(note.id);
            clearDraft(userId, note.id);
            toast({ title: "Note deleted", tone: "success" });
            navigate("/app/notes", { replace: true });
          } catch (e) {
            toast({ title: "Couldn't delete the note", description: errorMessage(e), tone: "error" });
            // Já tinha sido apagada (noutro separador): sai do editor de uma nota que não existe.
            if (isNotFound(e)) navigate("/app/notes", { replace: true });
            else leavingAfterDelete.current = false;
          }
        }}
      />
      <ConfirmDialog
        open={askLeave && blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (open) return;
          setAskLeave(false);
          if (blocker.state === "blocked") blocker.reset();
        }}
        title="Discard your changes?"
        description={!title.trim() ? "This note needs a title before it can be saved. If you leave now, your changes will be lost." : "Your latest changes couldn't be saved. If you leave now, they'll be lost."}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          clearDraft(userId, note.id);
          setAskLeave(false);
          blocker.proceed?.();
        }}
      />
    </Card>
  );
}

/** "Saving…", "Saved · edited 3 hours ago" ou o erro com "Try again". Visual só: o anúncio é à parte. */
function SaveStatus({
  dirty,
  restored,
  titleMissing,
  error,
  editedAt: edited,
  onRetry,
}: {
  dirty: boolean;
  restored: boolean;
  titleMissing: boolean;
  error: string | null;
  editedAt: string;
  onRetry: () => void;
}) {
  let content: ReactNode;
  if (dirty && error)
    content = (
      <>
        <span className="inline-flex items-center gap-1.5 font-medium text-danger">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          Couldn't save
        </span>
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-kampus-blue underline-offset-2 hover:underline">
          Try again
        </button>
      </>
    );
  else if (dirty && restored) content = <span className="font-medium text-warning">Not saved yet</span>;
  else if (dirty && titleMissing) content = <span className="font-medium text-warning">Add a title to save</span>;
  else if (dirty)
    content = (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <LoaderCircle aria-hidden className="size-4 shrink-0 motion-safe:animate-spin" />
        Saving…
      </span>
    );
  else
    content = (
      <>
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <CheckCircle2 aria-hidden className="size-4 shrink-0" />
          Saved
        </span>
        <span className="text-muted">· edited {edited}</span>
      </>
    );
  return <p className="flex min-h-6 flex-wrap items-center gap-x-1.5 text-sm">{content}</p>;
}
