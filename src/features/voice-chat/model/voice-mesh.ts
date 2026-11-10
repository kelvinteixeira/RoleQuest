import type { VoiceEnvelope, VoiceSignal } from "@/repositories/contracts";

/** The parts of RTCPeerConnection the mesh uses (a fake stands in for it in tests). */
export type PeerConnection = Pick<
  RTCPeerConnection,
  | "addTrack"
  | "createOffer"
  | "createAnswer"
  | "setLocalDescription"
  | "setRemoteDescription"
  | "addIceCandidate"
  | "close"
  | "connectionState"
  | "signalingState"
  | "localDescription"
  | "remoteDescription"
  | "onicecandidate"
  | "ontrack"
  | "onconnectionstatechange"
>;

export type PeerState = "connecting" | "connected" | "failed";

export interface VoicePeer {
  userId: string;
  state: PeerState;
  muted: boolean;
}

export interface VoiceMeshOptions {
  selfId: string;
  /** The microphone; its tracks go to every call. */
  localStream: MediaStream;
  send: (envelope: VoiceEnvelope) => void;
  createPeer: () => PeerConnection;
  /** Someone's audio arrived (a stream) or went away (null). */
  onRemoteStream: (userId: string, stream: MediaStream | null) => void;
  /** The list of peers (or one's state) changed. */
  onChange: () => void;
}

interface Peer extends VoicePeer {
  pc: PeerConnection;
  /** ICE candidates that came before the remote description. */
  pendingIce: RTCIceCandidateInit[];
}

/**
 * A full mesh of WebRTC calls: one call per other member in the channel.
 *
 * Who calls whom is fixed so two offers never cross: for each pair, the member
 * with the smaller id sends the offer. A newcomer announces itself (`join`);
 * a smaller id calls it straight away, a bigger one says `hello` so the
 * newcomer calls. A call that fails is set up again the same way.
 */
export class VoiceMesh {
  private readonly peers = new Map<string, Peer>();
  private muted = false;
  private stopped = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly opts: VoiceMeshOptions) {}

  /** Announces this member to the channel (again after a reconnect: every call is set up anew). */
  start() {
    this.signal(null, { kind: "join" });
  }

  stop() {
    if (this.stopped) return;
    this.signal(null, { kind: "leave" });
    this.stopped = true;
    for (const id of [...this.peers.keys()]) this.drop(id);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    for (const track of this.opts.localStream.getAudioTracks()) track.enabled = !muted;
    this.signal(null, { kind: "muted", muted });
  }

  list(): VoicePeer[] {
    return [...this.peers.values()].map(({ userId, state, muted }) => ({ userId, state, muted }));
  }

  /** Takes a signal from the channel; signals are handled one at a time, in the order they came. */
  handle(envelope: VoiceEnvelope): Promise<void> {
    this.queue = this.queue.then(() => this.process(envelope)).catch(() => undefined);
    return this.queue;
  }

  private async process({ from, to, signal }: VoiceEnvelope): Promise<void> {
    if (this.stopped || from === this.opts.selfId || (to !== null && to !== this.opts.selfId)) return;
    switch (signal.kind) {
      case "join":
        if (this.calls(from)) await this.call(from);
        else {
          this.drop(from); // a stale call from before they came back
          this.signal(from, { kind: "hello" });
        }
        return;
      case "hello":
        if (this.calls(from) && !this.peers.has(from)) await this.call(from);
        return;
      case "offer": {
        const peer = this.open(from);
        await peer.pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
        await this.flushIce(peer);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        if (this.peers.get(from) !== peer) return;
        this.signal(from, { kind: "answer", sdp: peer.pc.localDescription?.sdp ?? "" });
        this.signal(from, { kind: "muted", muted: this.muted });
        return;
      }
      case "answer": {
        const peer = this.peers.get(from);
        if (!peer || peer.pc.signalingState !== "have-local-offer") return;
        await peer.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
        await this.flushIce(peer);
        return;
      }
      case "ice": {
        const peer = this.peers.get(from);
        if (!peer) return;
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(signal.candidate).catch(() => undefined);
        else peer.pendingIce.push(signal.candidate);
        return;
      }
      case "muted": {
        const peer = this.peers.get(from);
        if (peer && peer.muted !== signal.muted) {
          peer.muted = signal.muted;
          this.opts.onChange();
        }
        return;
      }
      case "leave":
        this.drop(from);
        return;
    }
  }

  /** This member sends the offer to `other`. */
  private calls(other: string) {
    return this.opts.selfId < other;
  }

  private async call(userId: string) {
    const peer = this.open(userId);
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    if (this.peers.get(userId) !== peer) return; // replaced or dropped meanwhile
    this.signal(userId, { kind: "offer", sdp: peer.pc.localDescription?.sdp ?? "" });
    this.signal(userId, { kind: "muted", muted: this.muted });
  }

  /** A fresh call with `userId` (any previous one is closed). */
  private open(userId: string): Peer {
    this.drop(userId);
    const pc = this.opts.createPeer();
    const peer: Peer = { userId, pc, state: "connecting", muted: false, pendingIce: [] };
    this.peers.set(userId, peer);
    for (const track of this.opts.localStream.getAudioTracks()) pc.addTrack(track, this.opts.localStream);
    pc.onicecandidate = (e) => {
      if (e.candidate && this.peers.get(userId) === peer) this.signal(userId, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (this.peers.get(userId) === peer) this.opts.onRemoteStream(userId, e.streams[0] ?? new MediaStream([e.track]));
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(userId) !== peer) return;
      const state = pc.connectionState;
      if (state === "connected") peer.state = "connected";
      else if (state === "failed") {
        // Set the call up again once (a member who is gone just never answers).
        this.drop(userId);
        if (!this.stopped) this.signal(userId, { kind: "join" });
        return;
      } else if (state === "disconnected") peer.state = "connecting";
      this.opts.onChange();
    };
    this.opts.onChange();
    return peer;
  }

  private async flushIce(peer: Peer) {
    for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate).catch(() => undefined);
  }

  private drop(userId: string) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    this.peers.delete(userId);
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    this.opts.onRemoteStream(userId, null);
    this.opts.onChange();
  }

  private signal(to: string | null, signal: VoiceSignal) {
    this.opts.send({ from: this.opts.selfId, to, signal });
  }
}
