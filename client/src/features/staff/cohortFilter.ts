import { type Cohort, isUuid } from "@kampus/shared";

/**
 * A turma do filtro, a partir do `?cohort=` do URL. Um valor que não é um UUID (a API dava
 * 400 e o "Try again" nunca resultava) ou que não é de nenhuma turma (inventado, ou de uma
 * turma apagada) conta como "todas". Enquanto as turmas carregam, um UUID vale.
 */
export function cohortFilter(param: string | null, cohorts: Cohort[] | undefined): string {
  if (!param || !isUuid(param)) return "";
  if (cohorts && !cohorts.some((c) => c.id === param)) return "";
  return param;
}
