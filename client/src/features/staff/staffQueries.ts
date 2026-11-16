import type { StaffCohort } from "@kampus/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.ts";

/** Debaixo de ["staff"]: criar ou apagar alunos e tarefas também a volta a pedir. */
const staffCohortsKey = ["staff", "cohorts"] as const;

/** Para os selects: por nome (a API dá as turmas por data de início, para o dashboard). */
export const byName = (cohorts: StaffCohort[]) => [...cohorts].sort((a, b) => a.name.localeCompare(b.name));

/** As turmas, com a data de início; um `select` tira outra vista da mesma cache (ex.: `byName`). */
export function useStaffCohorts(select?: (cohorts: StaffCohort[]) => StaffCohort[]) {
  return useQuery({
    queryKey: staffCohortsKey,
    queryFn: async () => (await api<{ cohorts: StaffCohort[] }>("/staff/cohorts")).cohorts,
    staleTime: 5 * 60_000,
    select,
  });
}
