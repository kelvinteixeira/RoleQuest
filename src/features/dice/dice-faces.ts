import * as THREE from "three";

/**
 * Dice shapes with numbered faces, and the rotation that brings the rolled
 * face up towards the viewer. Pure geometry (no rendering), so it is tested.
 */

/** Sides with a real polyhedron and numbered faces (d100 is a d10 showing tens). */
export const NUMBERED_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);

/** One flat face of a die, in the die's own space. */
export interface DieFace {
  /** Outward unit normal. */
  normal: THREE.Vector3;
  center: THREE.Vector3;
  /** Unit vector in the face plane: the top of a number written on it. */
  up: THREE.Vector3;
  /** Side of the square a label on this face may take. */
  size: number;
}

/** The die's body, non-indexed so every triangle has its own vertices. */
export function dieGeometry(sides: number): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  switch (sides) {
    case 4:
      geometry = new THREE.TetrahedronGeometry(0.7);
      break;
    case 6:
      geometry = new THREE.BoxGeometry(0.78, 0.78, 0.78);
      break;
    case 8:
      geometry = new THREE.OctahedronGeometry(0.64);
      break;
    case 10:
    case 100:
      // Pentagonal bipyramid: ten triangular faces.
      geometry = new THREE.LatheGeometry([new THREE.Vector2(0, 0.66), new THREE.Vector2(0.58, 0), new THREE.Vector2(0, -0.66)], 5);
      break;
    case 12:
      geometry = new THREE.DodecahedronGeometry(0.62);
      break;
    case 20:
      geometry = new THREE.IcosahedronGeometry(0.66);
      break;
    default:
      geometry = new THREE.CylinderGeometry(0.52, 0.52, 0.26, 20);
  }
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.computeVertexNormals();
  return flat;
}

/** Groups the triangles of a convex die by their plane: one entry per face. */
export function facesOf(geometry: THREE.BufferGeometry): DieFace[] {
  const pos = geometry.getAttribute("position");
  const groups = new Map<string, { normal: THREE.Vector3; points: THREE.Vector3[] }>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (normal.lengthSq() < 1e-8) continue; // degenerate triangle (lathe poles)
    normal.normalize();
    const mid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
    if (normal.dot(mid) < 0) normal.negate(); // convex and centred: faces point outwards
    const key = normal
      .toArray()
      .map((v) => Math.round(v * 100))
      .join(",");
    const group = groups.get(key) ?? { normal, points: [] };
    group.points.push(a.clone(), b.clone(), c.clone());
    groups.set(key, group);
  }
  return [...groups.values()].map(({ normal, points }) => {
    const unique: THREE.Vector3[] = [];
    for (const p of points) if (!unique.some((u) => u.distanceToSquared(p) < 1e-8)) unique.push(p);
    const center = unique.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(unique.length);
    // The die's own "up" laid on the face (or its depth axis when the face is level).
    let up = new THREE.Vector3(0, 1, 0).projectOnPlane(normal);
    if (up.lengthSq() < 1e-4) up = new THREE.Vector3(0, 0, -1).projectOnPlane(normal);
    up.normalize();
    const reach = Math.min(...unique.map((p) => p.distanceTo(center)));
    return { normal, center, up, size: reach * (unique.length === 3 ? 0.95 : 1.15) };
  });
}

/**
 * What each face reads, and which face carries the rolled value.
 * d100 faces read tens ("00".."90") but the rolled face shows the full value.
 */
export function faceLabels(sides: number, faceCount: number, value: number): { labels: string[]; resultFace: number } {
  if (sides === 100) {
    const tens = Array.from({ length: faceCount }, (_, i) => String(i * 10).padStart(2, "0"));
    const resultFace = Math.floor((value % 100) / 10) % faceCount;
    tens[resultFace] = String(value);
    return { labels: tens, resultFace };
  }
  const labels = Array.from({ length: faceCount }, (_, i) => String(i + 1));
  return { labels, resultFace: Math.max(0, Math.min(faceCount - 1, value - 1)) };
}

/**
 * The die's orientation at rest: the face's normal points at the viewer and
 * its number stands upright on screen (`viewerUp`: the screen's up in world space).
 */
export function restQuaternion(face: DieFace, toViewer: THREE.Vector3, viewerUp: THREE.Vector3, twist = 0): THREE.Quaternion {
  const n = toViewer.clone().normalize();
  const up = viewerUp.clone().projectOnPlane(n).normalize().applyAxisAngle(n, twist);
  const world = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, n), up, n);
  const local = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(face.up, face.normal), face.up, face.normal);
  // world = R · local, and local is orthonormal: R = world · localᵀ.
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.transpose()));
}

/** A thrown die's path: bounces under gravity, then a short slide to rest. Times in seconds from its release. */
export interface ThrowPath {
  /** Moments it hits the table (for dust, clacks and camera shake). */
  impacts: number[];
  /** When it stops. */
  landAt: number;
  /** Height above the table at `t`. */
  heightAt: (t: number) => number;
}

const GRAVITY = 34;

export function throwPath(dropHeight: number, bounciness: number): ThrowPath {
  const hops = [dropHeight];
  for (let i = 0; i < 3; i++) hops.push(hops[hops.length - 1] * bounciness);
  // First a fall from the throw's height, then up-and-down hops lower each time.
  const durations = hops.map((h, i) => (i === 0 ? 1 : 2) * Math.sqrt((2 * h) / GRAVITY));
  const impacts: number[] = [];
  let at = 0;
  for (const d of durations) impacts.push((at += d));
  const landAt = at + 0.18;
  const heightAt = (t: number) => {
    if (t <= 0) return dropHeight;
    let start = 0;
    for (let i = 0; i < hops.length; i++) {
      const end = start + durations[i];
      if (t < end) {
        if (i === 0) return Math.max(0, dropHeight - 0.5 * GRAVITY * t * t);
        const half = durations[i] / 2;
        const s = t - start - half; // time from the top of the hop
        return Math.max(0, hops[i] - 0.5 * GRAVITY * s * s);
      }
      start = end;
    }
    return 0;
  };
  return { impacts, landAt, heightAt };
}
