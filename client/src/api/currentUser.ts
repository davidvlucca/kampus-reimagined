import type { PublicUser } from "@kampus/shared";
import { createContext, useContext } from "react";

/**
 * O utilizador que o RequireAuth deixou passar. As páginas leem-no daqui e não da cache:
 * quando a sessão cai (401, logout), a cache passa a null antes de o RequireAuth voltar a
 * renderizar, e uma página que renderizasse nesse intervalo (ex.: a meio de uma navegação)
 * via `null` e rebentava. Assim cada página vê sempre o mesmo utilizador que o seu
 * RequireAuth, e é ele que leva ao login.
 */
export const CurrentUserContext = createContext<PublicUser | null>(null);

/** Para ecrãs dentro de RequireAuth: o utilizador já está carregado. */
export function useCurrentUser(): PublicUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return user;
}
