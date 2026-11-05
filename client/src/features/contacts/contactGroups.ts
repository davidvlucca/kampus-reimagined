// A API só dá o cargo de cada pessoa do staff (não há ligação staff → turma). Os cargos de quem
// ensina e gere o programa ficam em "Your cohort team"; o resto (carreira, campus...) em "Campus".
const COHORT_ROLES = [/program manager/i, /teacher/i, /teaching assistant/i, /\bta\b/i, /instructor/i, /mentor/i];

export const isProgramManager = (contact: { title: string }) => /program manager/i.test(contact.title);

/** Divide os contactos pelos dois grupos, mantendo a ordem da API em cada um. */
export function groupContacts<T extends { title: string }>(contacts: T[]): { cohort: T[]; campus: T[] } {
  const cohort: T[] = [];
  const campus: T[] = [];
  for (const contact of contacts) (COHORT_ROLES.some((re) => re.test(contact.title)) ? cohort : campus).push(contact);
  return { cohort, campus };
}
