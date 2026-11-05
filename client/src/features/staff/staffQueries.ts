import type { StaffCohort } from "@kampus/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.ts";

/** Debaixo de ["staff"]: criar ou apagar alunos e tarefas também a volta a pedir. */
const staffCohortsKey = ["staff", "cohorts"] as const;

/** As turmas com a data de início (o `useCohorts` dá só id e nome). */
export function useStaffCohorts() {
  return useQuery({
    queryKey: staffCohortsKey,
    queryFn: async () => (await api<{ cohorts: StaffCohort[] }>("/staff/cohorts")).cohorts,
    staleTime: 5 * 60_000,
  });
}
