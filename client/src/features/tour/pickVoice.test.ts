import { describe, expect, it } from "vitest";
import { pickVoice, type VoiceInfo } from "./pickVoice.ts";

const v = (name: string, lang = "en-US", localService = true): VoiceInfo => ({ name, lang, localService });

describe("pickVoice", () => {
  it("salta as vozes de efeitos do macOS que vêm primeiro na lista", () => {
    expect(pickVoice([v("Albert"), v("Zarvox"), v("Bad News"), v("Samantha")])?.name).toBe("Samantha");
  });

  it("prefere uma voz natural ou neural a uma clássica", () => {
    expect(pickVoice([v("Samantha"), v("Google US English", "en-US", false)])?.name).toBe("Google US English");
    expect(pickVoice([v("Microsoft Zira"), v("Microsoft Aria Online (Natural) - English (United States)")])?.name).toContain("Aria");
  });

  it("aceita en-GB quando não há en-US boa", () => {
    expect(pickVoice([v("Fred"), v("Daniel", "en-GB")])?.name).toBe("Daniel");
  });

  it("devolve undefined sem vozes inglesas utilizáveis", () => {
    expect(pickVoice([v("Albert"), v("Joana", "pt-PT")])).toBeUndefined();
    expect(pickVoice([])).toBeUndefined();
  });
});
