/**
 * Primeiro erro de cada campo, a partir dos issues do Zod. `required` troca o "Required"
 * genérico pela mensagem do campo (ex.: "Enter a first name").
 */
export function issuesByField(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  required: Record<string, string | undefined> = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) errors[key] = issue.message === "Required" ? (required[key] ?? issue.message) : issue.message;
  }
  return errors;
}
