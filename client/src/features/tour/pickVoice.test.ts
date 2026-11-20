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

  it("para um guia homem escolhe uma voz de homem, mesmo havendo uma de mulher melhor", () => {
    expect(pickVoice([v("Samantha"), v("Daniel", "en-GB"), v("Rishi", "en-IN")], true)?.name).toBe("Daniel");
    expect(pickVoice([v("Google US English"), v("Google UK English Female", "en-GB"), v("Google UK English Male", "en-GB")], true)?.name).toBe("Google UK English Male");
  });

  it("para os outros guias não escolhe uma voz de homem (no Windows o David vinha primeiro)", () => {
    expect(pickVoice([v("Microsoft David"), v("Microsoft Zira")])?.name).toBe("Microsoft Zira");
    expect(pickVoice([v("Daniel", "en-GB"), v("Samantha")])?.name).toBe("Samantha");
  });

  it("sem voz do género pedido, fica a melhor que houver", () => {
    expect(pickVoice([v("Samantha"), v("Karen", "en-AU")], true)?.name).toBe("Samantha");
    expect(pickVoice([v("English United States"), v("English United Kingdom", "en-GB")], true)?.name).toBe("English United States");
  });

  it("devolve undefined sem vozes inglesas utilizáveis", () => {
    expect(pickVoice([v("Albert"), v("Joana", "pt-PT")])).toBeUndefined();
    expect(pickVoice([])).toBeUndefined();
  });
});
