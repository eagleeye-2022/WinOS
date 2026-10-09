import { beforeEach, describe, expect, it } from "vitest";
import { resolveNavModule, toUrlKey } from "@/lib/navigation/modules";
import { findScrollElement, scrollKeyFor, snapshotScroll } from "@/lib/navigation/scroll-restore";
import { useNavigationStore } from "@/stores/navigation-store";

describe("resolveNavModule", () => {
  it.each([
    ["/dashboard", "standup"],
    ["/dsm/member/u1", "standup"],
    ["/report/all", "standup"],
    ["/notes/member/u1", "standup"],
    ["/pulse/leave/requests/abc", "people"],
    ["/people", "people"],
    ["/projects", "projects"],
    ["/projects/P-1/tasks/T-9", "projects"],
    ["/settings/users", "users"],
    ["/sales", "sales"],
    ["/somewhere-new", "standup"],
  ])("%s → %s", (path, expected) => {
    expect(resolveNavModule(path)).toBe(expected);
  });

  it("does not match on a bare prefix of another segment", () => {
    expect(resolveNavModule("/projectsx")).toBe("standup");
  });

  it("lets ?module= pin shared routes to a module", () => {
    expect(resolveNavModule("/calendar", "?module=projects")).toBe("projects");
    expect(resolveNavModule("/calendar", new URLSearchParams("module=pulse"))).toBe("people");
    expect(resolveNavModule("/calendar", "module=bogus")).toBe("standup");
  });
});

describe("toUrlKey", () => {
  it("omits an empty query and normalises a leading ?", () => {
    expect(toUrlKey("/projects")).toBe("/projects");
    expect(toUrlKey("/projects", "?tab=INACTIVE")).toBe("/projects?tab=INACTIVE");
    expect(toUrlKey("/projects", new URLSearchParams({ q: "acme" }))).toBe("/projects?q=acme");
  });
});

describe("navigation store", () => {
  beforeEach(() => {
    useNavigationStore.setState({ modules: {} });
  });

  it("keeps an independent slice per module", () => {
    const { recordUrl } = useNavigationStore.getState();
    recordUrl("projects", "/projects/P-1?tab=USERS");
    recordUrl("standup", "/dsm/all?date=2026-10-07");
    const { modules } = useNavigationStore.getState();
    expect(modules.projects?.lastUrl).toBe("/projects/P-1?tab=USERS");
    expect(modules.standup?.lastUrl).toBe("/dsm/all?date=2026-10-07");
    expect(modules.people).toBeUndefined();
  });

  it("resetModule clears only that module", () => {
    const s = useNavigationStore.getState();
    s.recordUrl("projects", "/projects?tab=INACTIVE");
    s.setView("projects", "collapsed", ["3.1"]);
    s.saveScroll("projects", "/projects?tab=INACTIVE", [{ key: "p:0", top: 400, left: 0 }]);
    s.recordUrl("people", "/pulse/attendance?tab=team-attendance");
    s.resetModule("projects");
    const { modules } = useNavigationStore.getState();
    expect(modules.projects).toEqual({ lastUrl: null, scroll: {}, view: {} });
    expect(modules.people?.lastUrl).toBe("/pulse/attendance?tab=team-attendance");
  });

  it("drops a URL's scroll entry when saved empty and caps stored URLs", () => {
    const s = useNavigationStore.getState();
    s.saveScroll("projects", "/a", [{ key: "p:0", top: 10, left: 0 }]);
    s.saveScroll("projects", "/a", []);
    expect(useNavigationStore.getState().modules.projects?.scroll["/a"]).toBeUndefined();

    for (let i = 0; i < 40; i++) s.saveScroll("projects", `/u${i}`, [{ key: "p:0", top: i + 1, left: 0 }]);
    const scroll = useNavigationStore.getState().modules.projects!.scroll;
    expect(Object.keys(scroll)).toHaveLength(30);
    expect(scroll["/u0"]).toBeUndefined();
    expect(scroll["/u39"]?.[0].top).toBe(40);
  });
});

// Minimal Element stand-in — the unit suite runs in the node environment (no DOM).
type FakeEl = {
  attrs: Record<string, string>;
  children: FakeEl[];
  parentElement: FakeEl | null;
  scrollTop: number;
  scrollLeft: number;
  isConnected: boolean;
  getAttribute(name: string): string | null;
  contains(other: FakeEl): boolean;
  querySelector(sel: string): FakeEl | null;
};

function el(attrs: Record<string, string> = {}, children: FakeEl[] = []): FakeEl {
  const node: FakeEl = {
    attrs,
    children,
    parentElement: null,
    scrollTop: 0,
    scrollLeft: 0,
    isConnected: true,
    getAttribute: (name) => attrs[name] ?? null,
    contains(other) {
      for (let n: FakeEl | null = other; n; n = n.parentElement) if (n === node) return true;
      return false;
    },
    querySelector(sel) {
      const key = sel.match(/data-scroll-key="(.+)"/)?.[1];
      const walk = (n: FakeEl): FakeEl | null => {
        for (const c of n.children) {
          if (c.attrs["data-scroll-key"] === key) return c;
          const hit = walk(c);
          if (hit) return hit;
        }
        return null;
      };
      return walk(node);
    },
  };
  for (const c of children) c.parentElement = node;
  return node;
}

describe("scroll container keys", () => {
  it("round-trips a structural path from the nav root", () => {
    const target = el();
    const root = el({}, [el(), el({}, [el(), target])]);
    const key = scrollKeyFor(target as unknown as Element, root as unknown as Element);
    expect(key).toBe("p:1/1");
    expect(findScrollElement(root as unknown as Element, key!)).toBe(target);
  });

  it("prefers an explicit data-scroll-key", () => {
    const target = el({ "data-scroll-key": "task-board" });
    const root = el({}, [el({}, [target])]);
    expect(scrollKeyFor(target as unknown as Element, root as unknown as Element)).toBe("task-board");
  });

  it("snapshots only scrolled, connected containers inside the root", () => {
    const a = el();
    const b = el();
    const detached = el();
    const root = el({}, [a, b]);
    a.scrollTop = 120;
    b.scrollLeft = 0;
    detached.scrollTop = 50;
    detached.isConnected = false;
    const entries = snapshotScroll([a, b, detached] as unknown as Element[], root as unknown as Element);
    expect(entries).toEqual([{ key: "p:0", top: 120, left: 0 }]);
  });
});
