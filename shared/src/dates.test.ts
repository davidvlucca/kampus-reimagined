import { describe, expect, it } from "vitest";
import { addDays, deadlineStatus, localDateKey } from "./dates.ts";

// Datas construídas com o construtor local (ano, mês, dia, hora): o teste mede
// o comportamento na data local, seja qual for o fuso da máquina.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("deadlineStatus", () => {
  it("prazo hoje é 'Due today', não overdue", () => {
    expect(deadlineStatus("2026-10-31", at(2026, 10, 31))).toEqual({ kind: "today", days: 0, label: "Due today" });
  });

  it("prazo hoje continua 'Due today' às 23:59 e às 00:00", () => {
    expect(deadlineStatus("2026-10-31", at(2026, 10, 31, 23, 59)).kind).toBe("today");
    expect(deadlineStatus("2026-10-31", at(2026, 10, 31, 0, 0)).kind).toBe("today");
  });

  it("prazo ontem é overdue", () => {
    expect(deadlineStatus("2026-10-30", at(2026, 10, 31, 0, 1))).toEqual({ kind: "overdue", days: -1, label: "Overdue by 1 day" });
  });

  it("prazo amanhã é '1 day left' e depois '3 days left'", () => {
    expect(deadlineStatus("2026-11-01", at(2026, 10, 31, 23, 59)).label).toBe("1 day left");
    expect(deadlineStatus("2026-11-03", at(2026, 10, 31)).label).toBe("3 days left");
  });

  it("atravessa a mudança de hora sem perder um dia", () => {
    // Em Portugal a hora muda a 25 de outubro de 2026.
    expect(deadlineStatus("2026-10-26", at(2026, 10, 24, 23, 30)).days).toBe(2);
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
