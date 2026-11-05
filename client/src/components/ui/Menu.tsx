import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  /** Texto curto por baixo do rótulo (fica no nome acessível como descrição). */
  description?: string;
  tone?: "default" | "danger";
  onSelect: () => void;
}

/**
 * Botão que abre um menu de ações (o padrão "menu button" do WAI-ARIA): setas para cima e para
 * baixo, Home/End, Esc fecha e devolve o foco ao botão, clicar fora ou Tab fecha.
 * Sem o DropdownMenu do Radix: não é dependência do projeto e um menu de uma ou duas ações não o justifica.
 */
export function Menu({ label, icon, items, className }: { label: string; icon: ReactNode; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuItems = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  // Ao abrir, o foco vai para a primeira ação.
  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  // Clicar fora fecha (sem roubar o foco ao que se clicou).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = menuItems();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(list.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      // Sem isto o Esc chegava também ao dialog ou à página por baixo.
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") close(false);
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-card text-kampus-navy transition hover:bg-kampus-blue-soft [&_svg]:size-5",
          open && "border-kampus-blue bg-kampus-blue-soft",
        )}
      >
        {icon}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute end-0 top-full z-30 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-1.5 shadow-pop animate-fade-up"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-kampus-blue/60 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
                item.tone === "danger" ? "text-danger hover:bg-danger-soft focus:bg-danger-soft" : "text-kampus-navy hover:bg-kampus-blue-soft focus:bg-kampus-blue-soft",
              )}
            >
              {item.icon}
              <span className="min-w-0">
                {item.label}
                {item.description && <span className="mt-0.5 block text-xs font-normal text-muted">{item.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
