import { ArrowLeft, Home } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMe } from "../../api/hooks.ts";
import { homePathFor } from "../../components/layout/paths.ts";
import { Button, buttonClasses, Logo } from "../../components/ui/index.ts";

export function NotFoundPage() {
  const me = useMe();
  const navigate = useNavigate();
  const home = me.data ? homePathFor(me.data) : "/";

  // O React Router guarda a posição no histórico em `idx`; sem página anterior, "Go back" vai para casa.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(home);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="px-5 pt-6 sm:px-10">
        <Link to={home} className="inline-flex rounded-lg" aria-label="Kampus, go home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <p className="animate-fade-up bg-kampus-gradient bg-clip-text font-pixel text-[8rem] leading-none text-transparent sm:text-[11rem]">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">This page took a wrong turn</h1>
        <p className="mt-2 max-w-sm text-muted">
          The link might be old, or the page moved somewhere else on campus. Let's get you back on track.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link to={home} className={buttonClasses({ size: "lg" })}>
            <Home aria-hidden className="size-5" />
            Go home
          </Link>
          <Button variant="secondary" size="lg" icon={<ArrowLeft aria-hidden className="size-5" />} onClick={goBack}>
            Go back
          </Button>
        </div>
      </main>
    </div>
  );
}
