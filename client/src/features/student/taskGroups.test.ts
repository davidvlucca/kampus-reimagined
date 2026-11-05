import type { Task } from "@kampus/shared";
import { describe, expect, it } from "vitest";
import { countSummary, groupTasks } from "./taskGroups.ts";

const task = (id: string, dueDate: string | null, done = false): Task => ({
  id,
  title: id,
  dueDate,
  done,
  completedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  source: "personal",
  assignedBy: null,
});

const now = new Date(2026, 10, 5, 12, 0);

describe("groupTasks", () => {
  it("agrupa por prazo, pela ordem Overdue, Today, This week, Later, No date", () => {
    const { groups, done } = groupTasks(
      [task("none", null), task("later", "2026-12-01"), task("week", "2026-11-08"), task("today", "2026-11-05"), task("late", "2026-11-01")],
      now,
    );
    expect(groups.map((g) => [g.label, g.tasks.map((t) => t.id)])).toEqual([
      ["Overdue", ["late"]],
      ["Today", ["today"]],
      ["This week", ["week"]],
      ["Later", ["later"]],
      ["No date", ["none"]],
    ]);
    expect(done).toEqual([]);
  });

  it("as feitas vão para Done, seja qual for o prazo, e os grupos vazios não aparecem", () => {
    const { groups, done } = groupTasks([task("a", "2026-11-01", true), task("b", null, true), task("c", "2026-11-06")], now);
    expect(groups.map((g) => g.id)).toEqual(["week"]);
    expect(done.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("mantém a ordem da API dentro de cada grupo", () => {
    const { groups } = groupTasks([task("x", "2026-11-06"), task("y", "2026-11-07"), task("z", "2026-11-06")], now);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["x", "y", "z"]);
  });

  it("uma data inválida fica em No date em vez de rebentar", () => {
    const { groups } = groupTasks([task("bad", "2026-02-31")], now);
    expect(groups.map((g) => g.id)).toEqual(["none"]);
  });

  it("sem tarefas não há grupos", () => {
    expect(groupTasks([], now)).toEqual({ groups: [], done: [] });
  });
});

describe("countSummary", () => {
  it("diz quantas faltam e quantas estão feitas", () => {
    expect(countSummary(6, 1)).toBe("6 to do · 1 done");
    expect(countSummary(0, 0)).toBe("0 to do · 0 done");
  });
});
