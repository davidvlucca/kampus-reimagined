import { Minus, Pause, Play, Plus, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, IconButton, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";

type Mode = "focus" | "break";
type Status = "idle" | "running" | "paused";

const MIN_MINUTES = 1;
const MAX_MINUTES = 60;
const MODE_LABEL: Record<Mode, string> = { focus: "Focus", break: "Break" };

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const other = (mode: Mode): Mode => (mode === "focus" ? "break" : "focus");

// O Pomodoro só existe no dashboard: sair da página desmontava-o e o tempo voltava ao início.
// Guarda-se no sessionStorage (por separador), com a hora-alvo, para sobreviver a navegar e a recarregar.
const STORAGE_KEY = "kampus.pomodoro";

interface Saved {
  mode: Mode;
  status: Status;
  minutes: Record<Mode, number>;
  /** Hora (ms) a que o modo acaba, a correr. */
  target: number | null;
  /** Tempo que falta, parado ou em pausa. */
  remaining: number;
}

const isMinutes = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= MIN_MINUTES && v <= MAX_MINUTES;

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Saved>;
    const modeOk = v.mode === "focus" || v.mode === "break";
    const statusOk = v.status === "idle" || v.status === "running" || v.status === "paused";
    if (!modeOk || !statusOk || !isMinutes(v.minutes?.focus) || !isMinutes(v.minutes?.break)) return null;
    if (v.status === "running" && typeof v.target !== "number") return null;
    if (typeof v.remaining !== "number" || v.remaining < 0) return null;
    return v as Saved;
  } catch {
    // Sem storage (modo privado, bloqueado) ou JSON estragado: começa do zero.
    return null;
  }
}

function save(value: Saved | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem storage: o temporizador funciona na mesma, só não sobrevive a sair da página.
  }
}

/**
 * Pomodoro. Em 2023 começava a 0/0 e não arrancava; aqui tem valores por omissão e
 * o tempo vem de uma hora-alvo (Date.now), por isso não desliza com o separador em segundo plano.
 */
export function Pomodoro() {
  const toast = useToast();
  const [saved] = useState(load);
  const [minutes, setMinutes] = useState<Record<Mode, number>>(saved?.minutes ?? { focus: 25, break: 5 });
  const [mode, setMode] = useState<Mode>(saved?.mode ?? "focus");
  const [status, setStatus] = useState<Status>(saved?.status ?? "idle");
  const [remaining, setRemaining] = useState(() =>
    saved ? (saved.status === "running" && saved.target !== null ? Math.max(0, saved.target - Date.now()) : saved.remaining) : 25 * 60_000,
  );
  const [announcement, setAnnouncement] = useState("");
  // Hora (ms) a que o modo atual acaba; só existe a correr.
  const targetRef = useRef<number | null>(saved?.status === "running" ? saved.target : null);
  const modeRef = useRef<Mode>(saved?.mode ?? "focus");
  const minutesRef = useRef(minutes);
  // Botões de - e +: no limite ficam desativados e o foco ia parar ao <body>.
  const stepRefs = useRef<Partial<Record<`${Mode}-${"down" | "up"}`, HTMLButtonElement | null>>>({});

  useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);

  // Guarda a cada mudança de estado, não a cada tique: a correr, a hora-alvo chega para recalcular.
  const frozen = status === "running" ? 0 : remaining;
  useEffect(() => {
    save({ mode, status, minutes, target: status === "running" ? targetRef.current : null, remaining: frozen });
  }, [mode, status, minutes, frozen]);

  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      const target = targetRef.current;
      if (target === null) return;
      const now = Date.now();
      if (now < target) {
        setRemaining(target - now);
        return;
      }
      // Acabou: troca de modo e encadeia a partir da hora-alvo (sem perder tempo).
      let nextMode = other(modeRef.current);
      let nextTarget = target + minutesRef.current[nextMode] * 60_000;
      while (nextTarget <= now) {
        nextMode = other(nextMode);
        nextTarget += minutesRef.current[nextMode] * 60_000;
      }
      targetRef.current = nextTarget;
      modeRef.current = nextMode;
      setMode(nextMode);
      setRemaining(nextTarget - now);
      const message = nextMode === "break" ? "Focus done. Time for a break!" : "Break over. Back to focus!";
      setAnnouncement(message);
      toast({ title: message, tone: "info" });
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [status, toast]);

  const start = () => {
    targetRef.current = Date.now() + remaining;
    setStatus("running");
  };
  const pause = () => {
    if (targetRef.current !== null) setRemaining(Math.max(0, targetRef.current - Date.now()));
    targetRef.current = null;
    setStatus("paused");
  };
  const reset = () => {
    targetRef.current = null;
    modeRef.current = "focus";
    setMode("focus");
    setStatus("idle");
    setRemaining(minutes.focus * 60_000);
    setAnnouncement("");
  };
  const adjust = (which: Mode, delta: number) => {
    const value = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes[which] + delta));
    setMinutes((prev) => ({ ...prev, [which]: value }));
    if (which === mode) setRemaining(value * 60_000);
    // No limite este botão fica desativado: o foco passa para o do lado em vez de cair no <body>.
    if (value === MIN_MINUTES || value === MAX_MINUTES) stepRefs.current[`${which}-${delta < 0 ? "up" : "down"}`]?.focus();
  };

  const isFocus = mode === "focus";

  return (
    <Card>
      <CardHeader title="Pomodoro" description="Work in short focused bursts." icon={<Timer aria-hidden />} />
      <CardBody className="flex flex-col gap-5">
        {/* Sem o anel de antes: o relógio grande chega. Numa coluna estreita (lg) fica centrado;
            mais largo, o relógio à esquerda e os botões à direita. */}
        <div className="flex flex-wrap items-center justify-between gap-4 lg:flex-col lg:justify-center">
          <div className="flex flex-col lg:items-center">
            <span className={cn("text-xs font-semibold tracking-widest uppercase", isFocus ? "text-kampus-blue" : "text-success")}>{MODE_LABEL[mode]}</span>
            <span className="font-pixel text-[min(4.5rem,20vw)] leading-none text-kampus-navy tabular-nums" aria-label={`${MODE_LABEL[mode]}: ${formatClock(remaining)} left`} role="timer">
              {formatClock(remaining)}
            </span>
            {status === "paused" && <span className="text-xs text-muted">Paused</span>}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {status === "running" ? (
              <Button onClick={pause} icon={<Pause aria-hidden className="size-4" />}>
                Pause
              </Button>
            ) : (
              <Button onClick={start} icon={<Play aria-hidden className="size-4" />}>
                {status === "paused" ? "Resume" : "Start"}
              </Button>
            )}
            {/* No telemóvel só o ícone (o relógio e os dois botões não cabiam na mesma linha); o nome fica para o leitor de ecrã. */}
            <Button variant="secondary" onClick={reset} icon={<RotateCcw aria-hidden className="size-4" />} title="Reset" className="max-sm:w-11 max-sm:px-0">
              <span className="max-sm:sr-only">Reset</span>
            </Button>
          </div>
        </div>

        {/* Só anuncia a troca de modo, nunca cada segundo. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {status === "idle" && (
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
            {(["focus", "break"] as const).map((which) => (
              <div key={which} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-3">
                <span className="text-sm font-medium text-kampus-navy">{MODE_LABEL[which]}</span>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <IconButton
                    ref={(el) => {
                      stepRefs.current[`${which}-down`] = el;
                    }}
                    size="sm"
                    variant="secondary"
                    label={`Decrease ${which} time`}
                    icon={<Minus aria-hidden />}
                    disabled={minutes[which] <= MIN_MINUTES}
                    onClick={() => adjust(which, -1)}
                  />
                  <span className="w-12 text-center text-sm font-semibold text-text tabular-nums" aria-live="polite">
                    {minutes[which]} min
                  </span>
                  <IconButton
                    ref={(el) => {
                      stepRefs.current[`${which}-up`] = el;
                    }}
                    size="sm"
                    variant="secondary"
                    label={`Increase ${which} time`}
                    icon={<Plus aria-hidden />}
                    disabled={minutes[which] >= MAX_MINUTES}
                    onClick={() => adjust(which, 1)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
