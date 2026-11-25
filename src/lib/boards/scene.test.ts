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
    const arrow: Item = {
      id: "a",
      t: "arrow",
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      color: "#ffffff",
      w: 4,
      dash: false,
      head: true,
    };
    expect(moveItem(arrow, 1, 2)).toMatchObject({ x1: 1, y1: 2, x2: 2, y2: 3 });
    expect(itemBox({ id: "c", t: "circle", x: 50, y: 50, r: 10, color: "#ffffff" })).toEqual({
      x: 40,
      y: 40,
      w: 20,
      h: 20,
    });
  });

  it("builds paths and callout labels", () => {
    expect(smoothPath([0, 0, 10, 10, 20, 0])).toMatch(/^M0 0Q10 10 15 5L20 0$/);
    expect(calloutLabel("A", "Main")).toBe("A Main");
    expect(calloutLabel("Mid", "Mid")).toBe("Mid");
  });
});

import { abilityArea, ABILITY_AREAS, areaFor, areaKey, baseReach } from "./abilities";

describe("ability areas", () => {
  const ability = (dir = 0, reach = 1) =>
    ({
      id: "x",
      t: "ability",
      agent: "Viper",
      slot: "Ability2",
      x: 100,
      y: 100,
      team: "ally",
      s: 1,
      r: 0,
      area: true,
      dir,
      reach,
    }) as const;

  it("finds areas by the API's ability names", () => {
    expect(areaKey("Nebula / Dissipate")).toBe("nebula");
    expect(ABILITY_AREAS[areaKey("Hunter's Fury")]).toBeDefined();
    const viper = {
      name: "Viper",
      role: "controller",
      icon: null,
      abilities: [{ slot: "Ability2", name: "Toxic Screen", icon: null }],
    };
    expect(areaFor(viper, "Ability2")?.kind).toBe("wall");
    expect(areaFor(viper, "Ultimate")).toBeNull();
  });

  it("scales circles to the map and points walls where they are aimed", () => {
    const smoke = abilityArea(ability(), { kind: "circle", r: 4, style: "smoke" }, 6.7);
    expect(smoke.circles[0]!.r).toBeCloseTo(26.8);
    const wallDown = abilityArea(
      ability(90),
      { kind: "wall", length: 50, width: 1, from: "origin", style: "wall" },
      6.7,
    );
    const ys = wallDown.polys[0]!.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(335, 0);
    expect(wallDown.handle[1]).toBeCloseTo(435, 0);
  });

  it("puts the handle at reach 1 distance for every kind", () => {
    for (const spec of Object.values(ABILITY_AREAS)) {
      const shape = abilityArea(ability(30, 1), spec, 6.7);
      const d = Math.hypot(shape.handle[0] - 100, shape.handle[1] - 100);
      expect(d).toBeCloseTo(baseReach(spec, 6.7), 0);
    }
  });
});

import { rotateGeometry } from "./scene";

describe("rotation", () => {
  it("turns arrows around their middle", () => {
    const arrow = {
      id: "a",
      t: "arrow",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      color: "#ffffff",
      w: 4,
      dash: false,
      head: true,
    } as const;
    const turned = rotateGeometry(arrow, 90);
    expect(turned).toMatchObject({ x1: 50, y1: -50, x2: 50, y2: 50 });
  });
  it("keeps old boards valid: rotation defaults to 0", () => {
    const s = parseScene({ items: [{ id: "m", t: "marker", kind: "spike", x: 1, y: 1, color: "#ffffff" }] });
    expect(s.items[0]).toMatchObject({ r: 0, s: 1 });
  });
});
