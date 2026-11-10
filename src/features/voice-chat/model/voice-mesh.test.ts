import { describe, expect, it } from "vitest";
import type { VoiceEnvelope } from "@/repositories/contracts";
import { VoiceMesh, type PeerConnection } from "./voice-mesh";

/** Just enough of RTCPeerConnection to follow the offer/answer dance. */
class FakePeer {
  static count = 0;
  readonly id = ++FakePeer.count;
  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  closed = false;
  ice: RTCIceCandidateInit[] = [];
  onicecandidate: ((e: { candidate: { toJSON(): RTCIceCandidateInit } | null }) => void) | null = null;
  ontrack: unknown = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack() {
    return {};
  }
  async createOffer() {
    return { type: "offer" as const, sdp: `offer-${this.id}` };
  }
  async createAnswer() {
    return { type: "answer" as const, sdp: `answer-${this.id}` };
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    if (d.type === "answer" && this.signalingState !== "have-remote-offer") throw new Error("answer in wrong state");
    this.localDescription = d;
    this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    if (d.type === "answer" && this.signalingState !== "have-local-offer") throw new Error("answer in wrong state");
    this.remoteDescription = d;
    this.signalingState = d.type === "offer" ? "have-remote-offer" : "stable";
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.ice.push(c);
  }
  close() {
    this.closed = true;
  }
  /** Simulates the browser finding a route. */
  emitIce(candidate: string) {
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate }) } });
  }
  setConnection(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

const track = { enabled: true };
const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;

/** A broadcast channel: messages are queued and delivered one at a time, in order. */
function network() {
  const members = new Map<string, { mesh: VoiceMesh; peers: FakePeer[] }>();
  const queue: VoiceEnvelope[] = [];
  const log: VoiceEnvelope[] = [];
  return {
    log,
    add(id: string) {
      const peers: FakePeer[] = [];
      const mesh = new VoiceMesh({
        selfId: id,
        localStream: stream,
        send: (e) => {
          queue.push(e);
          log.push(e);
        },
        createPeer: () => {
          const p = new FakePeer();
          peers.push(p);
          return p as unknown as PeerConnection;
        },
        onRemoteStream: () => undefined,
        onChange: () => undefined,
      });
      members.set(id, { mesh, peers });
      return { mesh, peers };
    },
    remove(id: string) {
      members.delete(id);
    },
    async flush() {
      while (queue.length) {
        const e = queue.shift()!;
        for (const [id, m] of members) if (id !== e.from) await m.mesh.handle(e);
      }
    },
  };
}

/** The live (not closed) call `a` holds with `b` and its counterpart. */
function link(peersA: FakePeer[], peersB: FakePeer[]) {
  const a = peersA.filter((p) => !p.closed);
  const b = peersB.filter((p) => !p.closed);
  return { a, b };
}

describe("VoiceMesh", () => {
  it("connects a newcomer to someone already in the channel, whoever has the smaller id", async () => {
    for (const [first, second] of [["a", "b"], ["b", "a"]]) {
      const net = network();
      const one = net.add(first);
      one.mesh.start();
      await net.flush();
      const two = net.add(second);
      two.mesh.start();
      await net.flush();

      const { a, b } = link(one.peers, two.peers);
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0].signalingState).toBe("stable");
      expect(b[0].signalingState).toBe("stable");
      // "a" (the smaller id) always offers, exactly once.
      expect(net.log.filter((e) => e.signal.kind === "offer").map((e) => e.from)).toEqual(["a"]);
      expect(one.mesh.list().map((p) => p.userId)).toEqual([second]);
    }
  });

  it("never crosses offers when two members join at the same time", async () => {
    const net = network();
    const a = net.add("a");
    const b = net.add("b");
    a.mesh.start();
    b.mesh.start();
    await net.flush();
    expect(net.log.filter((e) => e.signal.kind === "offer")).toHaveLength(1);
    const live = link(a.peers, b.peers);
    expect(live.a).toHaveLength(1);
    expect(live.b).toHaveLength(1);
    expect(live.b[0].remoteDescription?.sdp).toBe(live.a[0].localDescription?.sdp);
  });

  it("builds a full mesh for three members", async () => {
    const net = network();
    const all = ["c", "a", "b"].map((id) => {
      const m = net.add(id);
      m.mesh.start();
      return m;
    });
    await net.flush();
    for (const m of all) {
      expect(m.mesh.list()).toHaveLength(2);
      expect(m.peers.filter((p) => !p.closed).every((p) => p.signalingState === "stable")).toBe(true);
    }
  });

  it("holds ICE candidates that arrive before the answer", async () => {
    const net = network();
    const a = net.add("a");
    await a.mesh.handle({ from: "b", to: null, signal: { kind: "join" } });
    const caller = a.peers[0];
    expect(caller.signalingState).toBe("have-local-offer");

    await a.mesh.handle({ from: "b", to: "a", signal: { kind: "ice", candidate: { candidate: "early" } } });
    expect(caller.ice).toEqual([]);
    await a.mesh.handle({ from: "b", to: "a", signal: { kind: "answer", sdp: "answer-b" } });
    expect(caller.ice).toEqual([{ candidate: "early" }]);
    expect(caller.signalingState).toBe("stable");
  });

  it("sends its own ICE candidates to the member it calls", async () => {
    const net = network();
    const a = net.add("a");
    const b = net.add("b");
    a.mesh.start();
    b.mesh.start();
    await net.flush();
    a.peers.find((p) => !p.closed)!.emitIce("route-1");
    await net.flush();
    expect(b.peers.find((p) => !p.closed)!.ice).toEqual([{ candidate: "route-1" }]);
  });

  it("handles signals one at a time, even when they arrive together", async () => {
    const net = network();
    const b = net.add("b");
    // An offer and its first candidate arrive back to back, without waiting.
    const offer = b.mesh.handle({ from: "a", to: "b", signal: { kind: "offer", sdp: "offer-a" } });
    const ice = b.mesh.handle({ from: "a", to: "b", signal: { kind: "ice", candidate: { candidate: "c1" } } });
    await Promise.all([offer, ice]);
    expect(b.peers[0].remoteDescription?.sdp).toBe("offer-a");
    expect(b.peers[0].ice).toEqual([{ candidate: "c1" }]);
  });

  it("shares mute state and drops whoever leaves", async () => {
    const net = network();
    const a = net.add("a");
    const b = net.add("b");
    a.mesh.start();
    b.mesh.start();
    await net.flush();

    b.mesh.setMuted(true);
    await net.flush();
    expect(a.mesh.list()).toEqual([{ userId: "b", state: "connecting", muted: true }]);
    expect(track.enabled).toBe(false);
    b.mesh.setMuted(false);

    b.mesh.stop();
    await net.flush();
    expect(a.mesh.list()).toEqual([]);
    expect(a.peers.every((p) => p.closed)).toBe(true);
  });

  it("sets a failed call up again", async () => {
    const net = network();
    const a = net.add("a");
    const b = net.add("b");
    a.mesh.start();
    b.mesh.start();
    await net.flush();

    b.peers.find((p) => !p.closed)!.setConnection("failed");
    await net.flush();
    const live = link(a.peers, b.peers);
    expect(live.a).toHaveLength(1);
    expect(live.b).toHaveLength(1);
    expect(live.a[0].signalingState).toBe("stable");
    expect(net.log.filter((e) => e.signal.kind === "offer")).toHaveLength(2);
  });

  it("sets everything up again when a member comes back after a reload", async () => {
    const net = network();
    const a = net.add("a");
    let b = net.add("b");
    a.mesh.start();
    b.mesh.start();
    await net.flush();

    net.remove("b"); // the tab closed without saying goodbye
    b = net.add("b");
    b.mesh.start();
    await net.flush();
    const live = link(a.peers, b.peers);
    expect(live.a).toHaveLength(1);
    expect(live.b).toHaveLength(1);
    expect(live.b[0].remoteDescription?.sdp).toBe(live.a[0].localDescription?.sdp);
  });
});
