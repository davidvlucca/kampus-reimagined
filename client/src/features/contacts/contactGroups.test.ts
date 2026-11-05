import { describe, expect, it } from "vitest";
import { groupContacts, isProgramManager } from "./contactGroups.ts";

const staff = ["Program Manager", "Lead Teacher", "Teaching Assistant", "Career Coach", "Campus Manager", "Staff"].map((title) => ({ title }));

describe("groupContacts", () => {
  it("quem ensina e gere o programa fica na equipa da turma; o resto no campus", () => {
    const { cohort, campus } = groupContacts(staff);
    expect(cohort.map((c) => c.title)).toEqual(["Program Manager", "Lead Teacher", "Teaching Assistant"]);
    expect(campus.map((c) => c.title)).toEqual(["Career Coach", "Campus Manager", "Staff"]);
  });

  it("\"Campus Manager\" não é Program Manager", () => {
    expect(isProgramManager({ title: "Campus Manager" })).toBe(false);
    expect(isProgramManager({ title: "program manager" })).toBe(true);
  });
});
