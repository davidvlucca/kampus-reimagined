import { Minus, Pause, Play, Plus, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, IconButton, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";

type Mode = "focus" | "break";
type Status = "idle" | "running" | "paused";

const MIN_MINUTES = 1;
const MAX_MINUTES = 60;
const MODE_LABEL: Record<Mode, string> = { focus: "Focus", break: "Break" };
const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const other = (mode: Mode): Mode => (mode === "focus" ? "break" : "focus");

/**
 * Pomodoro. Em 2023 começava a 0/0 e não arrancava; aqui tem valores por omissão e
 * o tempo vem de uma hora-alvo (Date.now), por isso não desliza com o separador em segundo plano.
 */
export function Pomodoro() {
  const toast = useToast();
  const [minutes, setMinutes] = useState<Record<Mode, number>>({ focus: 25, break: 5 });
  const [mode, setMode] = useState<Mode>("focus");
  const [status, setStatus] = useState<Status>("idle");
  const [remaining, setRemaining] = useState(25 * 60_000);
  const [announcement, setAnnouncement] = useState("");
  // Hora (ms) a que o modo atual acaba; só existe a correr.
  const targetRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>("focus");
  const minutesRef = useRef(minutes);

  useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);

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

  const total = minutes[mode] * 60_000;
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;

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
  };

  const isFocus = mode === "focus";

  return (
    <Card>
      <CardHeader title="Pomodoro" description="Work in short focused bursts." icon={<Timer aria-hidden />} />
      <CardBody className="flex flex-col items-center gap-5">
        <div className="relative grid size-52 place-items-center">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r={RADIUS} fill="none" strokeWidth="10" className="stroke-line" />
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              className={cn("motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300", isFocus ? "stroke-kampus-blue" : "stroke-success")}
            />
          </svg>
          <div className="relative flex flex-col items-center">
            <span className={cn("text-sm font-semibold tracking-wide uppercase", isFocus ? "text-kampus-blue" : "text-success")}>{MODE_LABEL[mode]}</span>
            <span className="font-pixel text-7xl leading-none text-kampus-navy tabular-nums" aria-label={`${MODE_LABEL[mode]}: ${formatClock(remaining)} left`} role="timer">
              {formatClock(remaining)}
            </span>
            {status === "paused" && <span className="text-xs text-muted">Paused</span>}
          </div>
        </div>

        {/* Só anuncia a troca de modo, nunca cada segundo. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

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
          <Button variant="secondary" onClick={reset} icon={<RotateCcw aria-hidden className="size-4" />}>
            Reset
          </Button>
        </div>

        {status === "idle" && (
          <div className="grid w-full grid-cols-2 gap-3">
            {(["focus", "break"] as const).map((which) => (
              <div key={which} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface p-3">
                <span className="text-sm font-medium text-kampus-navy">{MODE_LABEL[which]}</span>
                <div className="flex items-center gap-1">
                  <IconButton
                    size="sm"
                    variant="secondary"
                    label={`Decrease ${which} time`}
                    icon={<Minus aria-hidden />}
                    disabled={minutes[which] <= MIN_MINUTES}
                    onClick={() => adjust(which, -1)}
                  />
                  <span className="w-14 text-center text-sm font-semibold text-text tabular-nums" aria-live="polite">
                    {minutes[which]} min
                  </span>
                  <IconButton
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
