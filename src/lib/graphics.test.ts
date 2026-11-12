import { describe, expect, it } from "vitest";
import { detectLevel, graphicsProfile } from "./graphics";

describe("graphics quality", () => {
  it("auto picks low for weak devices, medium for phones, high for strong desktops", () => {
    expect(detectLevel({ cores: 4, memoryGb: 8 })).toBe("low");
    expect(detectLevel({ cores: 8, memoryGb: 2 })).toBe("low");
    expect(detectLevel({ cores: 8, memoryGb: 8, coarsePointer: true, screenWidth: 412 })).toBe("medium");
    expect(detectLevel({ cores: 12, memoryGb: 16, coarsePointer: false, screenWidth: 1920 })).toBe("high");
  });
  it("low turns shadows off and draws fewer pixels; an explicit choice wins", () => {
    expect(graphicsProfile("low")).toMatchObject({ shadows: false, dpr: [0.75, 1] });
    expect(graphicsProfile("high", { cores: 2 }).level).toBe("high");
  });
});
