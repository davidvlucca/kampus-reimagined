import type { Role } from "@kampus/shared";
import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "../../api/hooks.ts";
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
  const location = useLocation();

  if (me.isPending) return <FullPageSpinner label="Checking your session" />;
  if (me.isError) return <ErrorState className="min-h-dvh justify-center" message="We couldn't check your session." onRetry={() => me.refetch()} />;
  if (!me.data) {
    const state: LoginRedirectState = { from: location.pathname + location.search, reason: "session" };
    return <Navigate to={loginPath(role)} replace state={state} />;
  }
  if (me.data.role !== role) return <Navigate to={HOME[me.data.role]} replace />;
  return <Outlet />;
}
