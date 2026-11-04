import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/features/map/model/map-document";
import { placeProps } from "@/features/map/model/shapes";
import { roll } from "@/features/dice/dice-engine";
import { soundsFor } from "./room-sounds";

describe("table sounds", () => {
  const map = placeProps(placeProps(createBlankMap(6, 3), [{ x: 1, y: 1 }], ["door"]), [{ x: 3, y: 1 }], ["gate"]);
  const [door, gate] = map.props;

  it("one of each sound per batch", () => {
    const rollMsg = { type: "message.posted" as const, message: { id: "m", at: "", kind: "roll" as const, author: { id: "a", name: "A", color: "#fff" }, text: "x", roll: roll("1d20"), visibility: "public" as const } };
    expect(soundsFor([rollMsg, rollMsg, { type: "token.hp", tokenId: "t", delta: -3 }], { map })).toEqual(["dice", "hit"]);
    expect(soundsFor([{ type: "token.hp", tokenId: "t", delta: 4 }, { type: "combat.started", order: [] }], { map })).toEqual(["heal", "combat"]);
  });

  it("doors creak open and thud shut, gates clank, sprung traps snap", () => {
    expect(soundsFor([{ type: "prop.updated", propId: door.id, door: { open: true } }], { map })).toEqual(["door-open"]);
    const open = { ...map, props: map.props.map((p) => (p.id === door.id ? { ...p, door: { open: true, locked: false } } : p)) };
    expect(soundsFor([{ type: "prop.updated", propId: door.id, door: { open: false } }], { map: open })).toEqual(["door-close"]);
    expect(soundsFor([{ type: "prop.updated", propId: gate.id, door: { open: true } }], { map })).toEqual(["gate"]);
    // Locking an already-shut door changes nothing audible.
    expect(soundsFor([{ type: "prop.updated", propId: door.id, door: { locked: true, open: false } }], { map })).toEqual([]);
    expect(soundsFor([{ type: "prop.updated", propId: "trap", trap: { armed: false, hidden: false } }], { map })).toEqual(["trap"]);
  });
});
