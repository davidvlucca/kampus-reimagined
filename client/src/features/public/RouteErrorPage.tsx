import { AlertTriangle, Home, RotateCcw, Sparkles } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button, buttonClasses, Logo } from "../../components/ui/index.ts";
import { isChunkLoadError } from "../../lib/chunkError.ts";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";

/**
 * O errorElement da raiz: um erro de render ou um chunk que não carregou mostra isto em vez
 * da página do React Router com a stack. Os links são <a> normais e o botão recarrega a
 * página: depois de um erro, o estado em memória já não é de confiança.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return <ErrorScreen newVersion={isChunkLoadError(error)} />;
}

function ErrorScreen({ newVersion }: { newVersion: boolean }) {
  useDocumentTitle(newVersion ? "New version available" : "Something went wrong");

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="px-5 pt-6 sm:px-10">
        <a href="/" className="inline-flex rounded-lg" aria-label="Kampus, go home">
          <Logo />
        </a>
      </header>
      {/* O role="alert" vai num div: no <main> não é permitido e tirava o landmark à página. */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <div role="alert" className="flex w-full flex-col items-center">
          <span
            className={
              newVersion
                ? "grid size-16 place-items-center rounded-2xl bg-kampus-blue-soft text-kampus-blue"
                : "grid size-16 place-items-center rounded-2xl bg-danger-soft text-danger"
            }
          >
            {newVersion ? <Sparkles aria-hidden className="size-8" /> : <AlertTriangle aria-hidden className="size-8" />}
          </span>
          <h1 className="mt-5 text-2xl font-semibold sm:text-3xl">
            {newVersion ? "A new version of Kampus is available" : "Something went wrong"}
          </h1>
          <p className="mt-2 max-w-sm text-muted">
            {newVersion
              ? "Kampus was updated while this tab was open. Reload to get the latest version."
              : "This page hit an unexpected error. Reloading usually fixes it."}
          </p>
        </div>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Button size="lg" icon={<RotateCcw aria-hidden className="size-5" />} onClick={() => window.location.reload()}>
            Reload
          </Button>
          <a href="/" className={buttonClasses({ variant: "secondary", size: "lg" })}>
            <Home aria-hidden className="size-5" />
            Go home
          </a>
        </div>
      </main>
    </div>
  );
}
