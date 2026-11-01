import type { Role } from "@kampus/shared";
import { Navigate, Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CurrentUserContext } from "../../api/currentUser.ts";
import { keys, useMe } from "../../api/hooks.ts";
import { ErrorState, FullPageSpinner } from "../ui/index.ts";
import { HOME } from "./nav.ts";
import { loginPath } from "./paths.ts";

export interface LoginRedirectState {
  from?: string;
  reason?: "session";
}

/** Só deixa passar quem tem sessão e o papel certo. Sem sessão: vai para o login desse perfil. */
export function RequireAuth({ role }: { role: Role }) {
  const me = useMe();
  const qc = useQueryClient();
  const location = useLocation();

  if (me.isPending) return <FullPageSpinner label="Checking your session" />;
  if (me.isError) return <ErrorState className="min-h-dvh justify-center" message="We couldn't check your session." onRetry={() => me.refetch()} />;
  if (!me.data) {
    // Depois de "Log out" é só o login; com a sessão expirada, avisa e volta depois à página.
    const signedOut = qc.getQueryData<boolean>(keys.signedOut) === true;
    const state: LoginRedirectState | undefined = signedOut ? undefined : { from: location.pathname + location.search, reason: "session" };
    return <Navigate to={loginPath(role)} replace state={state} />;
  }
  if (me.data.role !== role) return <Navigate to={HOME[me.data.role]} replace />;
  return (
    <CurrentUserContext.Provider value={me.data}>
      <Outlet />
    </CurrentUserContext.Provider>
  );
}
