import { zValidator } from "@hono/zod-validator";
import { isUuid } from "@kampus/shared";
import type { ValidationTargets } from "hono";
import { createMiddleware } from "hono/factory";
import type { ZodType } from "zod";

/** zValidator com erros no formato da API: `{ error, fields }`, status 400. */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (result.success) return;
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return c.json({ error: "Please check the highlighted fields.", fields }, 400);
  });

/**
 * Um `:id` que não é UUID nunca existe: responde 404 com a mensagem da rota em vez de
 * deixar o Postgres dar erro. Vem antes da validação do corpo.
 */
export const uuidParam = (notFound: { error: string }) =>
  createMiddleware(async (c, next) => {
    if (!isUuid(c.req.param("id") ?? "")) return c.json(notFound, 404);
    await next();
  });
