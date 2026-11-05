import { describe, expect, it } from "vitest";
import { addDays, deadlineStatus, dueGroup, isDateKey, localDateKey } from "./dates.ts";

// Datas construídas com o construtor local (ano, mês, dia, hora): o teste mede
// o comportamento na data local, seja qual for o fuso da máquina.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("deadlineStatus", () => {
  it("prazo hoje é 'Due today', não overdue", () => {
    expect(deadlineStatus("2026-10-31", at(2026, 10, 31))).toEqual({ kind: "today", days: 0, unit: "day", label: "Due today" });
  });

  it("prazo hoje continua 'Due today' às 23:59 e às 00:00", () => {
    expect(deadlineStatus("2026-10-31", at(2026, 10, 31, 23, 59))?.kind).toBe("today");
    expect(deadlineStatus("2026-10-31", at(2026, 10, 31, 0, 0))?.kind).toBe("today");
  });

  it("prazo ontem é overdue", () => {
    expect(deadlineStatus("2026-10-30", at(2026, 10, 31, 0, 1))).toEqual({ kind: "overdue", days: -1, unit: "day", label: "Due yesterday" });
    expect(deadlineStatus("2026-10-29", at(2026, 10, 31))?.label).toBe("Overdue by 2 days");
  });

  it("prazo amanhã é 'Due tomorrow' e depois 'Due in 3 days'", () => {
    expect(deadlineStatus("2026-11-01", at(2026, 10, 31, 23, 59))?.label).toBe("Due tomorrow");
    expect(deadlineStatus("2026-11-03", at(2026, 10, 31))?.label).toBe("Due in 3 days");
  });

  it("conta em dias até 14 e depois em semanas, meses e anos", () => {
    const now = at(2026, 11, 3);
    const label = (key: string) => deadlineStatus(key, now)?.label;
    expect(label("2026-11-17")).toBe("Due in 14 days");
    expect(label("2026-11-18")).toBe("Due in 2 weeks");
    expect(label("2026-11-24")).toBe("Due in 3 weeks");
    expect(label("2027-01-03")).toBe("Due in 2 months");
    expect(label("2027-09-03")).toBe("Due in 10 months");
    expect(label("2027-11-03")).toBe("Due in 1 year");
    expect(label("2100-12-31")).toBe("Due in 74 years");
    expect(label("2026-10-20")).toBe("Overdue by 14 days");
    expect(label("2026-10-10")).toBe("Overdue by 3 weeks");
    expect(label("2026-09-01")).toBe("Overdue by 2 months");
    expect(label("2020-01-01")).toBe("Overdue by 7 years");
    expect(deadlineStatus("2026-11-24", now)?.unit).toBe("week");
  });

  it("uma data inválida dá null em vez de rebentar", () => {
    for (const bad of ["", "not a date", "2026-02-31", "2026-13-01", "26-11-03"]) {
      expect(deadlineStatus(bad, at(2026, 11, 3))).toBeNull();
    }
  });

  it("atravessa a mudança de hora sem perder um dia", () => {
    // Em Portugal a hora muda a 25 de outubro de 2026.
    expect(deadlineStatus("2026-10-26", at(2026, 10, 24, 23, 30))?.days).toBe(2);
  });
});

describe("localDateKey", () => {
  it("usa a data local, não a UTC", () => {
    expect(localDateKey(at(2026, 1, 1, 0, 5))).toBe("2026-01-01");
    expect(localDateKey(at(2026, 12, 31, 23, 55))).toBe("2026-12-31");
  });
});

describe("addDays", () => {
  it("soma e subtrai dias atravessando meses", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("isDateKey", () => {
  it("só aceita datas que existem, anos de 2 dígitos incluídos (não viram 19xx)", () => {
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("0026-11-03")).toBe(true);
    expect(isDateKey("2027-02-29")).toBe(false);
    expect(isDateKey("2026-11-3")).toBe(false);
  });
});

describe("dueGroup", () => {
  const now = at(2026, 11, 5, 23, 30);

  it("separa atrasadas, hoje, os 7 dias seguintes e depois", () => {
    expect(dueGroup("2026-11-04", now)).toBe("overdue");
    expect(dueGroup("2026-11-05", now)).toBe("today");
    expect(dueGroup("2026-11-06", now)).toBe("week");
    expect(dueGroup("2026-11-12", now)).toBe("week");
    expect(dueGroup("2026-11-13", now)).toBe("later");
  });

  it("sem prazo ou com uma data inválida fica em 'none'", () => {
    expect(dueGroup(null, now)).toBe("none");
    expect(dueGroup("2026-02-31", now)).toBe("none");
    expect(dueGroup("amanhã", now)).toBe("none");
  });

  it("hoje é a data local, também à meia-noite", () => {
    expect(dueGroup("2026-11-05", at(2026, 11, 5, 0, 0))).toBe("today");
    expect(dueGroup("2026-11-05", at(2026, 11, 6, 0, 0))).toBe("overdue");
  });
});
