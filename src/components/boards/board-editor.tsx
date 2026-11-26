"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  BringToFront,
  ChevronLeft,
  Circle,
  Copy,
  Eraser,
  ImageUp,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Redo2,
  RotateCcw,
  RotateCw,
  Slash,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { canvasToBlob, renderBoard } from "@/lib/boards/render-canvas";
import {
  COLORS,
  MARKER_LABEL,
  MARKER_PATHS,
  MARKERS,
  MAX_ITEMS,
  MAX_PEN_POINTS,
  itemBox,
  moveItem,
  newId,
  normalizeAngle,
  rotateGeometry,
  simplify,
  TEAM_COLOR,
  type BoardCatalog,
  type Item,
  type MarkerKind,
  type Scene,
  type Team,
} from "@/lib/boards/scene";
import {
  areaFor,
  baseReach,
  DEFAULT_SCALE,
  effectiveReach,
  isDirectional,
  primaryMetres,
  type AreaSpec,
} from "@/lib/boards/abilities";
import { saveBoard } from "@/app/(hub)/boards/actions";
import { SceneSvg, slotKey } from "./scene-svg";

type Tool = "select" | "pen" | "arrow" | "line" | "circle" | "rect" | "text" | "erase";
type Placement =
  | { t: "agent"; agent: string }
  | { t: "ability"; agent: string; slot: string }
  | { t: "marker"; kind: MarkerKind }
  | { t: "step" };
type Drag =
  | { mode: "move"; id: string; sx: number; sy: number; orig: Item; before: Scene; moved: boolean }
  | { mode: "aim"; id: string; before: Scene; moved: boolean; history: boolean }
  | { mode: "rotate"; id: string; cx: number; cy: number; a0: number; orig: Item; before: Scene; moved: boolean }
  | { mode: "draw"; id: string; ax: number; ay: number; before: Scene };

export type BoardParentRef = { kind: "strategy" | "opponent" | "vod" | "session" | "match"; id: string };

export type EditorInitial = {
  id: string | null;
  title: string;
  notes: string;
  map_id: string | null;
  side: "attack" | "defense" | null;
  valoplant_url: string;
  scene: Scene;
};

const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode }[] = [
  { id: "select", label: "Select and move", key: "V", icon: <MousePointer2 className="size-[18px]" /> },
  { id: "pen", label: "Draw", key: "P", icon: <Pencil className="size-[18px]" /> },
  { id: "arrow", label: "Arrow", key: "A", icon: <MoveUpRight className="size-[18px]" /> },
  { id: "line", label: "Line", key: "L", icon: <Slash className="size-[18px]" /> },
  { id: "circle", label: "Circle zone", key: "C", icon: <Circle className="size-[18px]" /> },
  { id: "rect", label: "Box zone", key: "R", icon: <Square className="size-[18px]" /> },
  { id: "text", label: "Text", key: "T", icon: <Type className="size-[18px]" /> },
  { id: "erase", label: "Eraser", key: "E", icon: <Eraser className="size-[18px]" /> },
];
const WIDTHS = [
  { w: 4, label: "Thin" },
  { w: 7, label: "Medium" },
  { w: 11, label: "Thick" },
];
const ROLE_ORDER = ["duelist", "initiator", "controller", "sentinel"];
const ROLE_LABEL: Record<string, string> = {
  duelist: "Duelists",
  initiator: "Initiators",
  controller: "Controllers",
  sentinel: "Sentinels",
};
const ITEM_LABEL: Record<Item["t"], string> = {
  agent: "Agent",
  ability: "Ability",
  marker: "Marker",
  step: "Step",
  pen: "Drawing",
  arrow: "Arrow",
  circle: "Circle zone",
  rect: "Box zone",
  text: "Text",
};
const round = (n: number) => Math.round(n * 10) / 10;

export function BoardEditor({
  catalog,
  initial,
  parent,
  parentLabel,
  backHref,
  sandbox = false,
}: {
  catalog: BoardCatalog;
  initial: EditorInitial;
  parent: BoardParentRef | null;
  parentLabel: string | null;
  backHref: string;
  /** Showcase: everything works except saving and uploading. */
  sandbox?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [mapId, setMapId] = useState<string | null>(initial.map_id ?? catalog.maps[0]?.id ?? null);
  const [side, setSide] = useState<"attack" | "defense" | null>(initial.side);
  const [valoplant, setValoplant] = useState(initial.valoplant_url);
  const [scene, setScene] = useState<Scene>(initial.scene);
  const [past, setPast] = useState<Scene[]>([]);
  const [future, setFuture] = useState<Scene[]>([]);
  const [dirty, setDirty] = useState(false);

  const [tool, setTool] = useState<Tool>("select");
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [width, setWidth] = useState(7);
  const [dash, setDash] = useState(false);
  const [team, setTeam] = useState<Team>("ally");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"agents" | "markers" | "board" | "details">("agents");
  const [agentQuery, setAgentQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  const selectedItem = scene.items.find((i) => i.id === selected) ?? null;
  const agentsByRole = useMemo(
    () =>
      ROLE_ORDER.map((r) => ({ role: r, agents: catalog.agents.filter((a) => a.role === r) })).filter(
        (g) => g.agents.length,
      ),
    [catalog.agents],
  );
  // Agents already on the board come first, so their utility is one click away.
  const agentGroups = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    const match = (a: BoardCatalog["agents"][number]) => !q || a.name.toLowerCase().includes(q);
    const onBoard: string[] = [];
    for (const i of scene.items) {
      if ((i.t === "agent" || i.t === "ability") && !onBoard.includes(i.agent.toLowerCase()))
        onBoard.push(i.agent.toLowerCase());
    }
    const placed = onBoard
      .map((n) => catalog.agents.find((a) => a.name.toLowerCase() === n))
      .filter((a): a is BoardCatalog["agents"][number] => Boolean(a && match(a)));
    const groups = [{ label: "On the board", agents: placed }];
    for (const g of agentsByRole) {
      groups.push({
        label: ROLE_LABEL[g.role] ?? g.role,
        agents: g.agents.filter((a) => match(a) && !onBoard.includes(a.name.toLowerCase())),
      });
    }
    return groups.filter((g) => g.agents.length);
  }, [agentQuery, scene.items, catalog.agents, agentsByRole]);
  const agentByName = useMemo(() => new Map(catalog.agents.map((a) => [a.name.toLowerCase(), a])), [catalog.agents]);
  const scale = catalog.maps.find((m) => m.id === mapId)?.scale ?? DEFAULT_SCALE;
  const specOf = (it: Item | null): AreaSpec | null =>
    it?.t === "ability" ? areaFor(agentByName.get(it.agent.toLowerCase()), it.slot) : null;
  /** Abilities with a wall, cone or line turn their area; everything else turns itself. */
  const aimsArea = (it: Item) => {
    const spec = it.t === "ability" && it.area ? specOf(it) : null;
    return Boolean(spec && isDirectional(spec));
  };
  const rotateBy = (it: Item, deg: number): Item => {
    if (it.t === "pen" || it.t === "arrow") return rotateGeometry(it, deg);
    if (it.t === "circle") return it;
    if (it.t === "ability" && aimsArea(it)) return { ...it, dir: Math.round(normalizeAngle(it.dir + deg)) };
    return { ...it, r: Math.round(normalizeAngle(it.r + deg)) };
  };
  const rotateSelected = (deg: number) => {
    const s = sceneRef.current;
    const it = s.items.find((i) => i.id === selected);
    if (it) commit({ ...s, items: s.items.map((i) => (i.id === it.id ? rotateBy(it, deg) : i)) });
  };

  // --- history --------------------------------------------------------------
  const commit = useCallback((next: Scene, before?: Scene) => {
    const prev = before ?? sceneRef.current;
    setPast((p) => [...p.slice(-79), prev]);
    setFuture([]);
    setScene(next);
    setDirty(true);
  }, []);
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1]!;
      setFuture((f) => [sceneRef.current, ...f]);
      setScene(prev);
      setSelected(null);
      return p.slice(0, -1);
    });
  }, []);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0]!;
      setPast((p) => [...p, sceneRef.current]);
      setScene(next);
      return f.slice(1);
    });
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<Item>) => {
      const s = sceneRef.current;
      commit({ ...s, items: s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i)) });
    },
    [commit],
  );
  const removeItem = useCallback(
    (id: string) => {
      const s = sceneRef.current;
      commit({ ...s, items: s.items.filter((i) => i.id !== id) });
      setSelected((cur) => (cur === id ? null : cur));
    },
    [commit],
  );
  const duplicateItem = useCallback(
    (id: string) => {
      const s = sceneRef.current;
      const it = s.items.find((i) => i.id === id);
      if (!it) return;
      const copy = { ...moveItem(it, 24, 24), id: newId() } as Item;
      commit({ ...s, items: [...s.items, copy] });
      setSelected(copy.id);
    },
    [commit],
  );
  const toFront = (id: string) => {
    const s = sceneRef.current;
    const it = s.items.find((i) => i.id === id);
    if (it) commit({ ...s, items: [...s.items.filter((i) => i.id !== id), it] });
  };

  // --- pointer --------------------------------------------------------------
  const toBoard = (e: { clientX: number; clientY: number }) => {
    const m = layerRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: round(p.x), y: round(p.y) };
  };

  const full = () => {
    if (sceneRef.current.items.length < MAX_ITEMS) return false;
    setError(`A board holds up to ${MAX_ITEMS} items. Delete some or start a new board.`);
    return true;
  };

  const place = (pl: Placement, p: { x: number; y: number }, keep: boolean): Item | null => {
    if (full()) return null;
    const s = sceneRef.current;
    const base = { id: newId(), x: p.x, y: p.y, s: 1, r: 0 };
    let item: Item;
    if (pl.t === "agent") item = { ...base, t: "agent", agent: pl.agent, team };
    else if (pl.t === "ability") {
      // With its area drawn, the icon shrinks so the smoke or wall stays readable.
      const spec = areaFor(agentByName.get(pl.agent.toLowerCase()), pl.slot);
      const size = spec ? (spec.style === "smoke" ? 0.6 : 0.75) : 1;
      item = { ...base, s: size, t: "ability", agent: pl.agent, slot: pl.slot, team, area: true, dir: 0, reach: 1 };
    } else if (pl.t === "marker") item = { ...base, t: "marker", kind: pl.kind, color };
    else {
      const n = Math.min(99, s.items.reduce((m, i) => (i.t === "step" ? Math.max(m, i.n) : m), 0) + 1);
      item = { ...base, t: "step", n, color };
    }
    commit({ ...s, items: [...s.items, item] });
    setSelected(item.id);
    if (!keep && pl.t !== "step") {
      setPlacement(null);
      setTool("select");
    }
    return item;
  };

  const onBoardPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = toBoard(e);
    if (placement) {
      const item = place(placement, p, e.shiftKey);
      // Walls, cones and lines: keep the button down and drag to aim them.
      const spec = specOf(item);
      if (item && spec && isDirectional(spec)) {
        dragRef.current = { mode: "aim", id: item.id, before: sceneRef.current, moved: false, history: false };
        svgRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (tool === "select" || tool === "erase") {
      setSelected(null);
      return;
    }
    if (tool === "text") {
      if (full()) return;
      const s = sceneRef.current;
      const item: Item = { id: newId(), t: "text", x: p.x, y: p.y, text: "Text", color, s: 1, r: 0 };
      commit({ ...s, items: [...s.items, item] });
      setSelected(item.id);
      setTool("select");
      setTimeout(() => textInputRef.current?.select(), 30);
      return;
    }
    if (full()) return;
    const id = newId();
    let item: Item;
    if (tool === "pen") item = { id, t: "pen", pts: [p.x, p.y], color, w: width, dash };
    else if (tool === "arrow" || tool === "line")
      item = { id, t: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, w: width, dash, head: tool === "arrow" };
    else if (tool === "circle") item = { id, t: "circle", x: p.x, y: p.y, r: 2, color };
    else item = { id, t: "rect", x: p.x, y: p.y, w: 2, h: 2, color, r: 0 };
    const before = sceneRef.current;
    dragRef.current = { mode: "draw", id, ax: p.x, ay: p.y, before };
    setScene({ ...before, items: [...before.items, item] });
    setSelected(null);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onItemPointerDown = (e: ReactPointerEvent<SVGGElement>, item: Item) => {
    if (placement) return;
    if (tool === "erase") {
      e.stopPropagation();
      removeItem(item.id);
      return;
    }
    if (tool !== "select") return; // drawing tools start on top of items too
    e.stopPropagation();
    const p = toBoard(e);
    setSelected(item.id);
    dragRef.current = {
      mode: "move",
      id: item.id,
      sx: p.x,
      sy: p.y,
      orig: item,
      before: sceneRef.current,
      moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onRotatePointerDown = (e: ReactPointerEvent<SVGGElement>, item: Item) => {
    e.stopPropagation();
    const b = itemBox(item);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const p = toBoard(e);
    const a0 = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
    dragRef.current = { mode: "rotate", id: item.id, cx, cy, a0, orig: item, before: sceneRef.current, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onHandlePointerDown = (e: ReactPointerEvent<SVGCircleElement>, item: Item) => {
    e.stopPropagation();
    dragRef.current = { mode: "aim", id: item.id, before: sceneRef.current, moved: false, history: true };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toBoard(e);
    if (d.mode === "rotate") {
      let delta = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI - d.a0;
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;
      if (!d.moved && Math.abs(delta) < 1) return;
      d.moved = true;
      const turned = rotateBy(d.orig, delta);
      setScene((s) => ({ ...s, items: s.items.map((i) => (i.id === d.id ? turned : i)) }));
      return;
    }
    if (d.mode === "aim") {
      setScene((s) => ({
        ...s,
        items: s.items.map((i) => {
          if (i.id !== d.id || i.t !== "ability") return i;
          const spec = specOf(i);
          if (!spec) return i;
          const dx = p.x - i.x;
          const dy = p.y - i.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 6) return i;
          d.moved = true;
          const dir = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
          // Only abilities whose size varies in game can be stretched, and only within the game's limits.
          if (!spec.adjust || !d.history) return { ...i, dir };
          const reach = effectiveReach(spec, dist / baseReach(spec, scale));
          return { ...i, dir, reach: Math.round(reach * 100) / 100 };
        }),
      }));
      return;
    }
    if (d.mode === "move") {
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 2) return;
      d.moved = true;
      const moved = moveItem(d.orig, dx, dy);
      setScene((s) => ({ ...s, items: s.items.map((i) => (i.id === d.id ? moved : i)) }));
      return;
    }
    setScene((s) => ({
      ...s,
      items: s.items.map((i) => {
        if (i.id !== d.id) return i;
        switch (i.t) {
          case "pen": {
            const lx = i.pts[i.pts.length - 2]!;
            const ly = i.pts[i.pts.length - 1]!;
            if (Math.hypot(p.x - lx, p.y - ly) < 2.5 || i.pts.length >= MAX_PEN_POINTS * 2) return i;
            return { ...i, pts: [...i.pts, p.x, p.y] };
          }
          case "arrow":
            return { ...i, x2: p.x, y2: p.y };
          case "circle":
            return { ...i, r: Math.max(2, round(Math.hypot(p.x - d.ax, p.y - d.ay))) };
          case "rect":
            return {
              ...i,
              x: Math.min(d.ax, p.x),
              y: Math.min(d.ay, p.y),
              w: Math.max(2, Math.abs(p.x - d.ax)),
              h: Math.max(2, Math.abs(p.y - d.ay)),
            };
          default:
            return i;
        }
      }),
    }));
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const s = sceneRef.current;
    if (d.mode === "rotate") {
      if (d.moved) {
        setPast((p) => [...p.slice(-79), d.before]);
        setFuture([]);
        setDirty(true);
      }
      return;
    }
    if (d.mode === "aim") {
      if (d.moved && d.history) {
        setPast((p) => [...p.slice(-79), d.before]);
        setFuture([]);
      }
      if (d.moved) setDirty(true);
      return;
    }
    if (d.mode === "move") {
      if (d.moved) {
        setPast((p) => [...p.slice(-79), d.before]);
        setFuture([]);
        setDirty(true);
      }
      return;
    }
    const item = s.items.find((i) => i.id === d.id);
    if (!item) return;
    let final: Item | null = item;
    if (item.t === "pen") {
      const pts = simplify(item.pts);
      final = { ...item, pts: pts.length === 2 ? [pts[0]!, pts[1]!, pts[0]! + 0.5, pts[1]!] : pts };
    } else if (item.t === "arrow" && Math.hypot(item.x2 - item.x1, item.y2 - item.y1) < 10) final = null;
    else if (item.t === "circle" && item.r < 8) final = null;
    else if (item.t === "rect" && (item.w < 8 || item.h < 8)) final = null;
    const items = final ? s.items.map((i) => (i.id === d.id ? final! : i)) : s.items.filter((i) => i.id !== d.id);
    if (final) commit({ ...s, items }, d.before);
    else setScene({ ...s, items });
  };

  // --- keyboard and paste -----------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        duplicateItem(selected);
        return;
      }
      if ((e.key === "[" || e.key === "]") && selected) {
        e.preventDefault();
        rotateSelected(e.key === "]" ? 15 : -15);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        removeItem(selected);
        return;
      }
      if (e.key === "Escape") {
        setPlacement(null);
        setSelected(null);
        setTool("select");
        return;
      }
      if (mod || e.altKey) return;
      const hit = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (hit) {
        setTool(hit.id);
        setPlacement(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rotateSelected reads the latest scene from a ref
  }, [selected, undo, redo, removeItem, duplicateItem]);

  const uploadBackground = useCallback(
    async (file: File) => {
      if (sandbox) return setError("Uploading images is off in this showcase.");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        return setError("Use a PNG, JPG or WebP image.");
      if (file.size > 8 * 1024 * 1024) return setError("That image is over 8 MB.");
      setNotice("Uploading image…");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `boards/bg-${crypto.randomUUID()}.${ext}`;
      const supabase = createSupabaseBrowser();
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
      if (upErr) {
        setNotice(null);
        return setError(`Upload failed: ${upErr.message}`);
      }
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      commit({ ...sceneRef.current, bg: { kind: "image", url } });
      setNotice("Image set as the background. Draw on top of it.");
    },
    [commit, sandbox],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea")) return;
      const file = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"))?.getAsFile();
      if (file) {
        e.preventDefault();
        void uploadBackground(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadBackground]);

  useEffect(() => {
    if (!dirty || saving || sandbox) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving, sandbox]);

  // --- styling changes apply to the selection too -----------------------------
  const pickColor = (c: string) => {
    setColor(c);
    if (selectedItem && "color" in selectedItem) updateItem(selectedItem.id, { color: c });
  };
  const pickWidth = (w: number) => {
    setWidth(w);
    if (selectedItem && (selectedItem.t === "pen" || selectedItem.t === "arrow")) updateItem(selectedItem.id, { w });
  };
  const toggleDash = () => {
    const next = !dash;
    setDash(next);
    if (selectedItem && (selectedItem.t === "pen" || selectedItem.t === "arrow"))
      updateItem(selectedItem.id, { dash: next });
  };
  const pickTeam = (t: Team) => {
    setTeam(t);
    if (selectedItem && (selectedItem.t === "agent" || selectedItem.t === "ability"))
      updateItem(selectedItem.id, { team: t });
  };
  const arm = (pl: Placement) => {
    setPlacement(pl);
    setSelected(null);
  };

  const downloadPng = async () => {
    const canvas = await renderBoard(scene, catalog, mapId, 1600);
    const blob = await canvasToBlob(canvas, "image/png");
    if (!blob) return setError("This browser couldn't turn the board into an image.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "board").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // --- save -------------------------------------------------------------------
  const save = async () => {
    if (!title.trim()) {
      setError("Give the board a title.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice("Saving…");
    let imageUrl: string | null = null;
    try {
      const canvas = await renderBoard(scene, catalog, mapId, 1400);
      const blob = (await canvasToBlob(canvas, "image/webp", 0.88)) ?? (await canvasToBlob(canvas, "image/png"));
      if (blob) {
        const ext = blob.type === "image/webp" ? "webp" : "png";
        const path = `boards/${crypto.randomUUID()}.${ext}`;
        const supabase = createSupabaseBrowser();
        const { error: upErr } = await supabase.storage.from("media").upload(path, blob, { contentType: blob.type });
        if (upErr) {
          setSaving(false);
          setNotice(null);
          setError(`Couldn't upload the board image: ${upErr.message}. Try again.`);
          return;
        }
        imageUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }
    } catch {
      imageUrl = null; // the board is still saved; the view draws it live
    }
    const res = await saveBoard({
      id: initial.id,
      title: title.trim(),
      notes,
      map_id: mapId,
      side,
      valoplant_url: valoplant,
      image_url: imageUrl,
      scene,
      parent,
    });
    if (!res.ok) {
      setSaving(false);
      setNotice(null);
      setError(res.error);
      return;
    }
    setDirty(false);
    router.push(`${res.href}?saved=1`);
  };

  const cursor = placement ? "copy" : tool === "select" ? "default" : tool === "erase" ? "not-allowed" : "crosshair";
  const mapName = catalog.maps.find((m) => m.id === mapId)?.name ?? null;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-[14px] text-fog">
          <Link href={backHref} className="inline-flex items-center gap-1 hover:text-bone">
            <ChevronLeft className="size-4" aria-hidden /> {parentLabel ?? "Back"}
          </Link>
          <span className="text-dim">/</span>
          <span>{initial.id ? "Edit board" : "New board"}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-[12.5px] text-fog">Title</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              maxLength={120}
              placeholder="A split: smokes and entry"
              className="h-10 border border-line bg-rail px-3 text-bone outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] text-fog">Map</span>
            <select
              value={mapId ?? ""}
              onChange={(e) => {
                setMapId(e.target.value || null);
                setDirty(true);
              }}
              className="h-10 border border-line bg-rail px-2 text-bone outline-none focus:border-accent"
            >
              {catalog.maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] text-fog">Side</span>
            <select
              value={side ?? ""}
              onChange={(e) => {
                setSide((e.target.value || null) as "attack" | "defense" | null);
                setDirty(true);
              }}
              className="h-10 border border-line bg-rail px-2 text-bone outline-none focus:border-accent"
            >
              <option value="">Both / not set</option>
              <option value="attack">Attack</option>
              <option value="defense">Defense</option>
            </select>
          </label>
          <div className="flex gap-2">
            <Link href={backHref} className={buttonClass("ghost")}>
              Cancel
            </Link>
            {sandbox ? (
              <button type="button" onClick={downloadPng} className={buttonClass("primary")}>
                Download image
              </button>
            ) : (
              <button type="button" onClick={save} disabled={saving} className={buttonClass("primary")}>
                {saving ? "Saving…" : "Save board"}
              </button>
            )}
          </div>
        </div>
        {sandbox ? (
          <p className="text-[13px] text-fog">
            Showcase mode: draw freely and download the image. Saving is off, so nothing you do here is kept.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="border-l-2 border-accent bg-accent/10 px-3 py-2 text-[14px] text-bone">
            {error}
          </p>
        ) : notice ? (
          <p role="status" className="text-[13px] text-fog">
            {notice}
          </p>
        ) : null}
      </header>

      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_340px]">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap" role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <ToolButton
              key={t.id}
              label={`${t.label} (${t.key})`}
              active={!placement && tool === t.id}
              onClick={() => {
                setTool(t.id);
                setPlacement(null);
              }}
            >
              {t.icon}
            </ToolButton>
          ))}
          <span className="mx-1 w-px self-stretch bg-line lg:mx-0 lg:my-1 lg:h-px lg:w-auto" aria-hidden />
          <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!past.length}>
            <Undo2 className="size-[18px]" />
          </ToolButton>
          <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!future.length}>
            <Redo2 className="size-[18px]" />
          </ToolButton>
          <span className="mx-1 w-px self-stretch bg-line lg:mx-0 lg:my-1 lg:h-px lg:w-auto" aria-hidden />
          <div className="flex flex-wrap gap-1 lg:grid lg:grid-cols-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                aria-label={`Colour: ${c.label}`}
                aria-pressed={color === c.value}
                onClick={() => pickColor(c.value)}
                className={clsx(
                  "grid size-10 place-items-center border transition-colors",
                  color === c.value ? "border-bone" : "border-transparent hover:border-line-strong",
                )}
              >
                <span className="size-5 rounded-full" style={{ background: c.value }} />
              </button>
            ))}
          </div>
          <span className="mx-1 w-px self-stretch bg-line lg:mx-0 lg:my-1 lg:h-px lg:w-auto" aria-hidden />
          {WIDTHS.map((w) => (
            <ToolButton key={w.w} label={`${w.label} line`} active={width === w.w} onClick={() => pickWidth(w.w)}>
              <span className="block w-5 rounded-full bg-current" style={{ height: Math.max(2, w.w / 2) }} />
            </ToolButton>
          ))}
          <ToolButton label="Dashed line" active={dash} onClick={toggleDash}>
            <span className="block w-6 border-t-[3px] border-dashed border-current" />
          </ToolButton>
        </div>

        {/* Board */}
        <div className="flex min-w-0 flex-col items-center gap-2">
          <div
            className="relative aspect-square w-full max-w-[min(100%,calc(100dvh-210px))] min-w-[280px] border border-line"
            style={{ cursor }}
          >
            <SceneSvg
              scene={scene}
              catalog={catalog}
              mapId={mapId}
              uid="editor"
              className="size-full"
              title={title || "Tactics board"}
              selectedId={selected}
              svgRef={svgRef}
              layerRef={layerRef}
              interactive
              onItemPointerDown={onItemPointerDown}
              onHandlePointerDown={onHandlePointerDown}
              onRotatePointerDown={onRotatePointerDown}
              boardHandlers={{
                onPointerDown: onBoardPointerDown,
                onPointerMove: onPointerMove,
                onPointerUp: onPointerUp,
                onPointerCancel: onPointerUp,
                onDragOver: (e) => {
                  if (e.dataTransfer.types.includes("text/x-board")) e.preventDefault();
                },
                onDrop: (e) => {
                  const raw = e.dataTransfer.getData("text/x-board");
                  if (!raw) return;
                  e.preventDefault();
                  try {
                    place(JSON.parse(raw) as Placement, toBoard(e), false);
                  } catch {
                    // not something dragged from the panel
                  }
                },
              }}
            />
          </div>
          <p className="text-center text-[12.5px] text-dim">
            {placement
              ? "Click the map to place it. Hold Shift to place several. Esc to stop."
              : "Drag agents and utility from the right onto the map. Paste a screenshot (Ctrl+V) to draw on top of it."}
          </p>
        </div>

        {/* Side panel */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
          {selectedItem ? (
            <SelectionPanel
              item={selectedItem}
              textInputRef={textInputRef}
              onChange={(patch) => updateItem(selectedItem.id, patch)}
              onDelete={() => removeItem(selectedItem.id)}
              onDuplicate={() => duplicateItem(selectedItem.id)}
              onFront={() => toFront(selectedItem.id)}
              onTeam={pickTeam}
              spec={specOf(selectedItem)}
              aimsArea={aimsArea(selectedItem)}
              onRotate={rotateSelected}
            />
          ) : null}

          <div className="border border-line bg-panel">
            <div role="tablist" className="grid grid-cols-4 border-b border-line">
              {(
                [
                  ["agents", "Agents"],
                  ["markers", "Markers"],
                  ["board", "Board"],
                  ["details", "Details"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={clsx(
                    "h-10 border-b-2 text-[13.5px] font-medium transition-colors",
                    tab === id ? "border-accent text-bone" : "border-transparent text-fog hover:text-bone",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === "agents" ? (
                <div className="flex flex-col gap-3">
                  <TeamToggle team={team} onChange={pickTeam} />
                  <input
                    type="search"
                    value={agentQuery}
                    onChange={(e) => setAgentQuery(e.target.value)}
                    placeholder="Find an agent"
                    aria-label="Find an agent"
                    className="h-10 border border-line bg-rail px-3 text-[14px] text-bone outline-none focus:border-accent"
                  />
                  <p className="text-[12.5px] text-dim">
                    Click the agent or one of their abilities (C, Q, E, X), then click the map. You can also drag them.
                  </p>
                  {agentGroups.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1.5 text-[12.5px] text-fog">{g.label}</p>
                      <ul className="flex flex-col gap-1">
                        {g.agents.map((a) => (
                          <AgentRow key={a.name} agent={a} team={team} placement={placement} onArm={arm} />
                        ))}
                      </ul>
                    </div>
                  ))}
                  {agentGroups.length === 0 ? (
                    <p className="text-[13.5px] text-fog">No agent matches that name.</p>
                  ) : null}
                </div>
              ) : null}

              {tab === "markers" ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-2">
                    {MARKERS.map((k) => {
                      const pl: Placement = { t: "marker", kind: k };
                      const armed = placement?.t === "marker" && placement.kind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/x-board", JSON.stringify(pl))}
                          onClick={() => arm(pl)}
                          className={clsx(
                            "flex h-11 items-center gap-2 border bg-rail px-3 text-[14px] text-bone",
                            armed ? "border-bone" : "border-line hover:border-line-strong",
                          )}
                        >
                          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                            <path
                              d={MARKER_PATHS[k]}
                              fill="none"
                              stroke={color}
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {MARKER_LABEL[k]}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => arm({ t: "step" })}
                    className={clsx(
                      "flex h-11 items-center gap-2 border bg-rail px-3 text-[14px] text-bone",
                      placement?.t === "step" ? "border-bone" : "border-line hover:border-line-strong",
                    )}
                  >
                    <span
                      className="grid size-6 place-items-center rounded-full font-display text-[14px] font-bold"
                      style={{ background: color, color: "#0b0f14" }}
                    >
                      1
                    </span>
                    Numbered steps (1, 2, 3…)
                  </button>
                  <p className="text-[12.5px] text-dim">Markers use the colour picked in the toolbar.</p>
                </div>
              ) : null}

              {tab === "board" ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-1.5 text-[12.5px] text-fog">Background</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ["map", mapName ? `${mapName} map` : "Map"],
                          ["blank", "Blank"],
                          ["image", "Image"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={scene.bg.kind === k}
                          onClick={() => {
                            if (k === "image") return fileRef.current?.click();
                            commit({ ...scene, bg: { kind: k } });
                          }}
                          className={clsx(
                            "h-10 truncate border px-2 text-[13.5px]",
                            scene.bg.kind === k
                              ? "border-accent bg-accent/10 text-bone"
                              : "border-line text-fog hover:text-bone",
                          )}
                        >
                          {k === "image" ? <ImageUp className="mr-1 inline size-4 align-[-3px]" aria-hidden /> : null}
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      aria-label="Upload a background image"
                      onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])}
                    />
                    <p className="mt-1.5 text-[12.5px] text-dim">
                      Use Image to draw over a ValoPlant export or a screenshot. You can also paste one with Ctrl+V.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-[14px] text-bone">
                    <input
                      type="checkbox"
                      checked={scene.callouts}
                      onChange={(e) => commit({ ...scene, callouts: e.target.checked })}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    Show callouts
                  </label>
                  <div>
                    <p className="mb-1.5 text-[12.5px] text-fog">Rotation</p>
                    <div className="flex gap-1.5">
                      {([0, 90, 180, 270] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={scene.rot === r}
                          onClick={() => commit({ ...scene, rot: r })}
                          className={clsx(
                            "h-10 flex-1 border text-[13.5px]",
                            scene.rot === r
                              ? "border-accent bg-accent/10 text-bone"
                              : "border-line text-fog hover:text-bone",
                          )}
                        >
                          {r}°
                        </button>
                      ))}
                      <button
                        type="button"
                        title="Rotate 90°"
                        aria-label="Rotate 90 degrees"
                        onClick={() => commit({ ...scene, rot: ((scene.rot + 90) % 360) as Scene["rot"] })}
                        className="grid size-10 place-items-center border border-line text-fog hover:text-bone"
                      >
                        <RotateCw className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-line pt-3">
                    {confirmClear ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] text-bone">Remove everything drawn?</span>
                        <button
                          type="button"
                          className={buttonClass("danger")}
                          onClick={() => {
                            commit({ ...scene, items: [] });
                            setSelected(null);
                            setConfirmClear(false);
                          }}
                        >
                          Clear board
                        </button>
                        <button type="button" className={buttonClass("ghost")} onClick={() => setConfirmClear(false)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={buttonClass("secondary")}
                        onClick={() => setConfirmClear(true)}
                        disabled={!scene.items.length}
                      >
                        <Trash2 className="size-4" aria-hidden /> Clear board
                      </button>
                    )}
                    <p className="mt-1.5 text-[12.5px] text-dim">You can undo it with Ctrl+Z until you save.</p>
                  </div>
                </div>
              ) : null}

              {tab === "details" ? (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12.5px] text-fog">Notes for the players</span>
                    <textarea
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setDirty(true);
                      }}
                      maxLength={4000}
                      rows={6}
                      className="border border-line bg-rail px-3 py-2 text-bone outline-none focus:border-accent"
                      placeholder="Timings, who calls it, what to do if they stack A…"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12.5px] text-fog">ValoPlant link (optional)</span>
                    <input
                      value={valoplant}
                      onChange={(e) => {
                        setValoplant(e.target.value);
                        setDirty(true);
                      }}
                      inputMode="url"
                      placeholder="https://valoplant.gg/…"
                      className="h-10 border border-line bg-rail px-3 text-bone outline-none focus:border-accent"
                    />
                    <span className="text-[12.5px] text-dim">
                      Players get a button to open the original in ValoPlant.
                    </span>
                  </label>
                  {parent && parentLabel ? (
                    <p className="text-[13px] text-fog">
                      Shown on: <span className="text-bone">{parentLabel}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "grid size-10 place-items-center border transition-colors disabled:opacity-35",
        active
          ? "border-accent bg-accent/15 text-bone"
          : "border-line text-fog hover:border-line-strong hover:text-bone",
      )}
    >
      {children}
    </button>
  );
}

function AgentRow({
  agent,
  team,
  placement,
  onArm,
}: {
  agent: BoardCatalog["agents"][number];
  team: Team;
  placement: Placement | null;
  onArm: (pl: Placement) => void;
}) {
  const pl: Placement = { t: "agent", agent: agent.name };
  const armed = placement?.t === "agent" && placement.agent === agent.name;
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        title={agent.name}
        aria-label={`Place ${agent.name}`}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/x-board", JSON.stringify(pl))}
        onClick={() => onArm(pl)}
        className={clsx(
          "grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-rail transition-colors",
          armed ? "border-bone" : "border-transparent hover:border-line-strong",
        )}
        style={{ boxShadow: `inset 0 0 0 2px ${TEAM_COLOR[team]}66` }}
      >
        {agent.icon ? (
          <img src={agent.icon} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <span className="font-display text-[13px] font-bold text-bone">{agent.name.slice(0, 2)}</span>
        )}
      </button>
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-bone">{agent.name}</span>
      <div className="flex shrink-0 gap-1">
        {agent.abilities.map((ab) => {
          const apl: Placement = { t: "ability", agent: agent.name, slot: ab.slot };
          const on = placement?.t === "ability" && placement.agent === agent.name && placement.slot === ab.slot;
          return (
            <button
              key={ab.slot}
              type="button"
              title={`${ab.name} (${slotKey(ab.slot)})`}
              aria-label={`Place ${ab.name}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/x-board", JSON.stringify(apl))}
              onClick={() => onArm(apl)}
              className={clsx(
                "relative grid size-9 place-items-center border bg-rail transition-colors",
                on ? "border-bone" : "border-line hover:border-line-strong",
              )}
            >
              {ab.icon ? (
                <img src={ab.icon} alt="" className="size-6 object-contain" draggable={false} />
              ) : (
                <span className="text-[12px] text-bone">{slotKey(ab.slot)}</span>
              )}
              <span className="absolute bottom-0 right-0.5 text-[9.5px] font-semibold leading-none text-fog">
                {slotKey(ab.slot)}
              </span>
            </button>
          );
        })}
      </div>
    </li>
  );
}

function TeamToggle({ team, onChange }: { team: Team; onChange: (t: Team) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Team">
      {(["ally", "enemy"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={team === t}
          onClick={() => onChange(t)}
          className={clsx(
            "flex h-10 items-center justify-center gap-2 border text-[14px]",
            team === t ? "border-bone text-bone" : "border-line text-fog hover:text-bone",
          )}
        >
          <span className="size-3 rounded-full" style={{ background: TEAM_COLOR[t] }} />
          {t === "ally" ? "Us" : "Enemy"}
        </button>
      ))}
    </div>
  );
}

function SelectionPanel({
  item,
  textInputRef,
  onChange,
  onDelete,
  onDuplicate,
  onFront,
  onTeam,
  spec,
  aimsArea,
  onRotate,
}: {
  item: Item;
  spec: AreaSpec | null;
  aimsArea: boolean;
  onRotate: (deg: number) => void;
  textInputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<Item>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFront: () => void;
  onTeam: (t: Team) => void;
}) {
  const directional = spec ? isDirectional(spec) : false;
  return (
    <div className="flex flex-col gap-3 border border-line-strong bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-bone">
          {ITEM_LABEL[item.t]}
          {item.t === "agent" ? `: ${item.agent}` : ""}
        </p>
        <div className="flex gap-1">
          <ToolButton label="Duplicate (Ctrl+D)" onClick={onDuplicate}>
            <Copy className="size-4" />
          </ToolButton>
          <ToolButton label="Bring to front" onClick={onFront}>
            <BringToFront className="size-4" />
          </ToolButton>
          <ToolButton label="Delete (Del)" onClick={onDelete}>
            <Trash2 className="size-4" />
          </ToolButton>
        </div>
      </div>
      {item.t === "text" ? (
        <input
          ref={textInputRef}
          value={item.text}
          maxLength={200}
          onChange={(e) => onChange({ text: e.target.value })}
          aria-label="Text"
          className="h-10 border border-line bg-rail px-3 text-bone outline-none focus:border-accent"
        />
      ) : null}
      {item.t === "step" ? (
        <label className="flex items-center gap-2 text-[14px] text-fog">
          Number
          <input
            type="number"
            min={1}
            max={99}
            value={item.n}
            onChange={(e) => onChange({ n: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
            className="h-9 w-20 border border-line bg-rail px-2 text-bone"
          />
        </label>
      ) : null}
      {item.t === "agent" || item.t === "ability" ? <TeamToggle team={item.team} onChange={onTeam} /> : null}
      {item.t === "ability" && spec ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <label className="flex items-center gap-2 text-[14px] text-bone">
            <input
              type="checkbox"
              checked={item.area}
              onChange={(e) => onChange({ area: e.target.checked })}
              className="size-4 accent-[var(--color-accent)]"
            />
            Show the ability&apos;s area
          </label>
          {item.area ? (
            <>
              {directional ? (
                <label className="flex items-center gap-3 text-[14px] text-fog">
                  Direction
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={((((item.dir + 180) % 360) + 360) % 360) - 180}
                    onChange={(e) => onChange({ dir: Number(e.target.value) })}
                    className="flex-1 accent-[var(--color-accent)]"
                  />
                </label>
              ) : null}
              {spec.adjust ? (
                <label className="flex items-center gap-3 text-[14px] text-fog">
                  {spec.kind === "circle" ? "Radius" : "Length"}
                  <input
                    type="range"
                    min={spec.adjust[0]}
                    max={spec.adjust[1]}
                    step={0.5}
                    value={Math.round(primaryMetres(spec) * effectiveReach(spec, item.reach) * 2) / 2}
                    onChange={(e) => onChange({ reach: Number(e.target.value) / primaryMetres(spec) })}
                    className="flex-1 accent-[var(--color-accent)]"
                  />
                  <span className="num w-12 text-right text-bone">
                    {Math.round(primaryMetres(spec) * effectiveReach(spec, item.reach))} m
                  </span>
                </label>
              ) : (
                <p className="text-[13px] text-fog">
                  In-game size: {primaryMetres(spec)} m{" "}
                  {spec.kind === "circle" ? "radius" : spec.kind === "cone" ? "range" : "long"}.
                </p>
              )}
              {directional || spec.adjust ? (
                <p className="text-[12.5px] text-dim">
                  Drag the white handle on the map to {directional ? "aim" : "resize"} it
                  {directional && spec.adjust ? " and set its length" : ""}.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {"s" in item ? (
        <label className="flex items-center gap-3 text-[14px] text-fog">
          {item.t === "ability" ? "Icon size" : "Size"}
          <input
            type="range"
            min={0.6}
            max={2}
            step={0.1}
            value={item.s}
            onChange={(e) => onChange({ s: Number(e.target.value) })}
            className="flex-1 accent-[var(--color-accent)]"
          />
        </label>
      ) : null}
      {item.t !== "circle" ? (
        <div className="flex items-center gap-2 text-[14px] text-fog">
          <span className="mr-auto">{aimsArea ? "Turn the area" : "Rotate"}</span>
          {"r" in item && !aimsArea ? <span className="num text-bone">{Math.round(item.r)}°</span> : null}
          {item.t === "ability" && aimsArea ? (
            <span className="num text-bone">{Math.round(normalizeAngle(item.dir))}°</span>
          ) : null}
          <ToolButton label="Rotate left 15° ([)" onClick={() => onRotate(-15)}>
            <RotateCcw className="size-4" />
          </ToolButton>
          <ToolButton label="Rotate right 15° (])" onClick={() => onRotate(15)}>
            <RotateCw className="size-4" />
          </ToolButton>
          <ToolButton label="Rotate 90°" onClick={() => onRotate(90)}>
            <span className="text-[12px] font-semibold">90°</span>
          </ToolButton>
        </div>
      ) : null}
      {item.t === "arrow" ? (
        <label className="flex items-center gap-2 text-[14px] text-bone">
          <input
            type="checkbox"
            checked={item.head}
            onChange={(e) => onChange({ head: e.target.checked })}
            className="size-4 accent-[var(--color-accent)]"
          />
          Arrowhead
        </label>
      ) : null}
      <p className="text-[12.5px] text-dim">
        Colour, line width and dashes from the toolbar change the selection. Drag it to move it; drag the round handle
        above it to turn it.
      </p>
    </div>
  );
}
