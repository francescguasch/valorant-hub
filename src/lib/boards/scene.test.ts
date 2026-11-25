import { describe, expect, it } from "vitest";
import { arrowHead, calloutLabel, itemBox, moveItem, parseScene, simplify, smoothPath, type Item } from "./scene";

describe("tactics board scene", () => {
  it("accepts a valid scene and fills defaults", () => {
    const s = parseScene({ items: [{ id: "a", t: "agent", agent: "Jett", x: 10, y: 20, team: "ally" }] });
    expect(s.bg).toEqual({ kind: "map" });
    expect(s.rot).toBe(0);
    expect(s.items[0]).toMatchObject({ t: "agent", s: 1 });
  });

  it("turns malformed data into an empty board", () => {
    expect(parseScene({ items: [{ t: "agent", x: "nope" }] }).items).toEqual([]);
    expect(parseScene(null).items).toEqual([]);
    expect(parseScene({ bg: { kind: "image", url: "javascript:alert(1)" } }).items).toEqual([]);
  });

  it("simplifies straight strokes to their ends", () => {
    const pts = [0, 0, 10, 0.2, 20, -0.1, 30, 0, 40, 0];
    expect(simplify(pts)).toEqual([0, 0, 40, 0]);
    expect(simplify([0, 0, 10, 0, 10, 10])).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it("draws an arrowhead at the end point", () => {
    const [tip, a, b] = arrowHead(0, 0, 100, 0, 6);
    expect(tip).toEqual([100, 0]);
    expect(a![0]).toBeLessThan(100);
    expect(a![1]).toBeCloseTo(-b![1]);
  });

  it("moves every kind of item", () => {
    const pen: Item = { id: "p", t: "pen", pts: [0, 0, 10, 10], color: "#ffffff", w: 4, dash: false };
    expect((moveItem(pen, 5, -5) as typeof pen).pts).toEqual([5, -5, 15, 5]);
    const arrow: Item = { id: "a", t: "arrow", x1: 0, y1: 0, x2: 1, y2: 1, color: "#ffffff", w: 4, dash: false, head: true };
    expect(moveItem(arrow, 1, 2)).toMatchObject({ x1: 1, y1: 2, x2: 2, y2: 3 });
    expect(itemBox({ id: "c", t: "circle", x: 50, y: 50, r: 10, color: "#ffffff" })).toEqual({ x: 40, y: 40, w: 20, h: 20 });
  });

  it("builds paths and callout labels", () => {
    expect(smoothPath([0, 0, 10, 10, 20, 0])).toMatch(/^M0 0Q10 10 15 5L20 0$/);
    expect(calloutLabel("A", "Main")).toBe("A Main");
    expect(calloutLabel("Mid", "Mid")).toBe("Mid");
  });
});
