import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { dieGeometry, faceLabels, facesOf, restQuaternion, throwPath } from "./dice-faces";

describe("dice faces", () => {
  it.each([
    [4, 4],
    [6, 6],
    [8, 8],
    [10, 10],
    [12, 12],
    [20, 20],
    [100, 10],
  ])("a d%i has %i flat faces, all pointing outwards", (sides, count) => {
    const faces = facesOf(dieGeometry(sides));
    expect(faces).toHaveLength(count);
    for (const f of faces) {
      expect(f.normal.dot(f.center)).toBeGreaterThan(0);
      expect(Math.abs(f.up.dot(f.normal))).toBeLessThan(1e-6);
      expect(f.size).toBeGreaterThan(0.1);
    }
  });

  it("brings the rolled face towards the viewer, its number upright", () => {
    const faces = facesOf(dieGeometry(20));
    const { resultFace } = faceLabels(20, faces.length, 17);
    const toViewer = new THREE.Vector3(0, 10, 6.5).normalize();
    const screenUp = new THREE.Vector3(0, 6.5, -10).normalize();
    const q = restQuaternion(faces[resultFace], toViewer, screenUp);
    expect(faces[resultFace].normal.clone().applyQuaternion(q).dot(toViewer)).toBeCloseTo(1, 5);
    expect(faces[resultFace].up.clone().applyQuaternion(q).dot(screenUp)).toBeCloseTo(1, 5);
  });

  it("labels faces 1..n and puts the value on its face; a d100 shows tens and the full value", () => {
    expect(faceLabels(20, 20, 20)).toEqual({ labels: Array.from({ length: 20 }, (_, i) => String(i + 1)), resultFace: 19 });
    const d100 = faceLabels(100, 10, 47);
    expect(d100.labels[d100.resultFace]).toBe("47");
    expect(d100.labels.filter((l) => l.length === 2 && l.endsWith("0"))).toHaveLength(9);
  });
});

describe("throw path", () => {
  it("falls, bounces lower each time and rests on the table", () => {
    const path = throwPath(2.6, 0.42);
    expect(path.impacts).toHaveLength(4);
    expect(path.heightAt(0)).toBeCloseTo(2.6);
    for (const t of path.impacts) expect(path.heightAt(t - 1e-4)).toBeLessThan(0.05);
    const peaks = path.impacts.slice(0, -1).map((t, i) => path.heightAt((t + path.impacts[i + 1]) / 2));
    expect(peaks[0]).toBeGreaterThan(peaks[1]);
    expect(peaks[1]).toBeGreaterThan(peaks[2]);
    expect(path.heightAt(path.landAt + 1)).toBe(0);
  });
});
