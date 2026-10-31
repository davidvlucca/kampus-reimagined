import type { Portal, PublicUser } from "@kampus/shared";

export const loginPath = (portal: Portal) => `/login/${portal}`;

/** Para onde vai o utilizador depois de entrar: a visita abre sozinha até ser feita ou saltada. */
export function homePathFor(user: PublicUser): string {
  if (user.role === "staff") return "/staff";
  if (!user.tourCompletedAt && !user.tourSkippedAt) return "/app/tour";
  return "/app";
}
