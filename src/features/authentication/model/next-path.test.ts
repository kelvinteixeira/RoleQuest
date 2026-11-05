import { describe, expect, it } from "vitest";
import { afterOnboarding, safeNextPath, withNext } from "./next-path";

describe("post-auth redirect", () => {
  it("keeps same-origin paths and refuses everything else", () => {
    expect(safeNextPath("/join/abc123")).toBe("/join/abc123");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    // URL parsers drop tabs/newlines: "/\t/evil.example" would become "//evil.example".
    expect(safeNextPath("/\t/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\n/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\r/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/join/abc?x=1#y")).toBe("/join/abc?x=1#y");
  });

  it("carries next along only when there is one", () => {
    expect(withNext("/onboarding", "/join/abc123")).toBe("/onboarding?next=%2Fjoin%2Fabc123");
    expect(withNext("/onboarding", null)).toBe("/onboarding");
  });

  it("an onboarded user skips a stale onboarding step and goes where it was heading", () => {
    expect(afterOnboarding("/onboarding?next=%2Fjoin%2Fabc")).toBe("/join/abc");
    expect(afterOnboarding("/onboarding")).toBe("/dashboard");
    expect(afterOnboarding("/campaign/c1")).toBe("/campaign/c1");
  });
});
