import { describe, expect, it } from "vitest";
import { cohortFilter } from "./cohortFilter.ts";

const WEB = { id: "7986c509-4171-4a90-bd63-5d6bad8059e5", name: "Web Dev Oct 2026" };
const OTHER = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("filtro de turma a partir do URL", () => {
  it("sem ?cohort= são todas", () => {
    expect(cohortFilter(null, [WEB])).toBe("");
    expect(cohortFilter("", [WEB])).toBe("");
  });

  it("lixo no URL conta como todas (não chega à API)", () => {
    for (const garbage of ["abc", "123", "<script>", `${WEB.id}x`]) {
      expect(cohortFilter(garbage, undefined)).toBe("");
      expect(cohortFilter(garbage, [WEB])).toBe("");
    }
  });

  it("um UUID de uma turma que não existe conta como todas, depois de as turmas carregarem", () => {
    expect(cohortFilter(OTHER, undefined)).toBe(OTHER);
    expect(cohortFilter(OTHER, [WEB])).toBe("");
  });

  it("uma turma que existe fica", () => {
    expect(cohortFilter(WEB.id, undefined)).toBe(WEB.id);
    expect(cohortFilter(WEB.id, [WEB])).toBe(WEB.id);
  });
});
