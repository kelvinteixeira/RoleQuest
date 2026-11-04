import { doorOf, PROP_BY_ID } from "@/features/map/model/map-document";
import type { RoomEvent, RoomState } from "@/features/virtual-tabletop/model/types";
import type { SfxName } from "./sfx";

/**
 * Which sounds a batch of table events makes. Pure: the same events sound the
 * same for every player once they arrive over Realtime. `before` is the room
 * prior to the batch (to tell a door from a gate, an open from a close).
 */
export function soundsFor(events: RoomEvent[], before: Pick<RoomState, "map">): SfxName[] {
  const out: SfxName[] = [];
  for (const e of events) {
    switch (e.type) {
      case "message.posted":
        if (e.message.roll && e.message.author.id !== "trap") out.push("dice");
        break;
      case "token.hp":
        out.push(e.delta < 0 ? "hit" : "heal");
        break;
      case "token.moved":
        out.push("step");
        break;
      case "combat.started":
        out.push("combat");
        break;
      case "prop.updated": {
        const prop = before.map.props.find((p) => p.id === e.propId);
        const def = prop && PROP_BY_ID.get(prop.propId);
        if (e.trap?.armed === false && e.trap.hidden === false) out.push("trap");
        if (e.door?.open !== undefined && prop && doorOf(prop)?.open !== e.door.open) out.push(def?.feature === "gate" ? "gate" : e.door.open ? "door-open" : "door-close");
        if (e.lit === true) out.push("fire");
        break;
      }
    }
  }
  // One of each per batch: an attack with three rolls is still one rattle.
  return [...new Set(out)];
}
