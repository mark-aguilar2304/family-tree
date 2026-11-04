import { describe, expect, it } from "vitest";
import {
  ancestorIds,
  buildTreeGraph,
  collapseBranches,
  countDescendants,
  descendantIds,
  filterTreeByMode,
  layoutTree,
  searchTreePeople,
  type TreeGraph,
} from "@/lib/genealogy/tree";
import { makeParentage, makeParticipant, makePartnership, makePerson } from "./fixtures";

const people = [
  makePerson("a", { display_name: "Ada" }),
  makePerson("b", { display_name: "Ben" }),
  makePerson("c", { display_name: "Cleo" }),
  makePerson("d", { display_name: "Dana", surname: "Stone" }),
  makePerson("archived", {
    display_name: "Archived",
    archived_at: "2026-01-02T00:00:00.000Z",
  }),
];

const parentage = [
  makeParentage("ab", "a", "b"),
  makeParentage("bc", "b", "c"),
  makeParentage("bd-ended", "b", "d", {
    end_date: "2020-01-01",
    end_date_precision: "year",
  }),
  makeParentage("a-archived", "a", "archived"),
  makeParentage("adoptive", "a", "d", { parentage_type: "adoptive" }),
];

describe("buildTreeGraph", () => {
  it("keeps active people and active parentage only", () => {
    const graph = buildTreeGraph(people, parentage, [], []);

    expect(graph.nodes.map((node) => node.id)).toEqual(["a", "b", "c", "d"]);
    expect(graph.edges.map((edge) => edge.id)).toEqual([
      "parentage:ab",
      "parentage:bc",
      "parentage:adoptive",
    ]);
    expect(graph.edges.find((edge) => edge.id === "parentage:adoptive")?.label).toBe(
      "Adoptive",
    );
    expect(graph.edges.find((edge) => edge.id === "parentage:ab")?.label).toBeUndefined();
  });

  it("draws one partnership edge per additional participant", () => {
    const partnership = makePartnership("p1", { status: "divorced" });
    const participants = [
      makeParticipant("pa", "p1", "b", "2026-01-01T00:00:00.000Z"),
      makeParticipant("pb", "p1", "c", "2026-01-02T00:00:00.000Z"),
      makeParticipant("pc", "p1", "d", "2026-01-03T00:00:00.000Z"),
    ];

    const graph = buildTreeGraph(people, [], [partnership], participants);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]).toMatchObject({
      id: "partnership:p1:c",
      source: "b",
      target: "c",
      label: "Marriage",
      dashed: true,
    });
    expect(graph.edges[1]).toMatchObject({
      id: "partnership:p1:d",
      source: "b",
      target: "d",
      label: undefined,
    });
  });

  it("skips partnerships with fewer than two visible participants", () => {
    const partnership = makePartnership("p1");
    const graph = buildTreeGraph(
      people,
      [],
      [partnership],
      [makeParticipant("pa", "p1", "archived")],
    );

    expect(graph.edges).toHaveLength(0);
  });
});

describe("ancestor and descendant traversal", () => {
  const graph: TreeGraph = {
    nodes: people
      .filter((entry) => !entry.archived_at)
      .map((entry) => ({ id: entry.id, person: entry })),
    edges: [
      { id: "a-b", source: "a", target: "b", kind: "parentage" },
      { id: "b-c", source: "b", target: "c", kind: "parentage" },
      { id: "c-d", source: "c", target: "d", kind: "parentage" },
    ],
  };

  it("walks multiple generations", () => {
    expect([...ancestorIds(graph, "d")]).toEqual(["c", "b", "a"]);
    expect([...descendantIds(graph, "a")]).toEqual(["b", "c", "d"]);
    expect(countDescendants(graph, "a")).toBe(3);
  });

  it("does not loop forever on a malformed cycle", () => {
    const cyclic: TreeGraph = {
      nodes: [],
      edges: [
        { id: "a-b", source: "a", target: "b", kind: "parentage" },
        { id: "b-a", source: "b", target: "a", kind: "parentage" },
      ],
    };

    expect([...descendantIds(cyclic, "a")]).toEqual(["b", "a"]);
    expect([...ancestorIds(cyclic, "a")]).toEqual(["b", "a"]);
  });

  it("filters to a focus person and their ancestors or descendants", () => {
    expect(filterTreeByMode(graph, "b", "ancestors").nodes.map((node) => node.id)).toEqual([
      "a",
      "b",
    ]);
    expect(
      filterTreeByMode(graph, "b", "descendants").nodes.map((node) => node.id),
    ).toEqual(["b", "c", "d"]);
    expect(filterTreeByMode(graph, "b", "all")).toBe(graph);
    expect(filterTreeByMode(graph, "missing", "ancestors")).toBe(graph);
  });

  it("hides descendants of collapsed branches and keeps the collapsed person", () => {
    const collapsed = collapseBranches(graph, new Set(["b"]));

    expect(collapsed.nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(collapsed.edges.map((edge) => edge.id)).toEqual(["a-b"]);
    expect(collapseBranches(graph, new Set())).toBe(graph);
  });
});

describe("layoutTree", () => {
  it("positions every node from top to bottom", () => {
    const graph = buildTreeGraph(people.slice(0, 3), parentage.slice(0, 2), [], []);
    const layout = layoutTree(graph);
    const byId = new Map(layout.nodes.map((node) => [node.id, node.position]));

    for (const position of byId.values()) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
    expect(byId.get("b")!.y).toBeGreaterThan(byId.get("a")!.y);
    expect(byId.get("c")!.y).toBeGreaterThan(byId.get("b")!.y);
    expect(layout.edges).toEqual(graph.edges);
  });
});

describe("searchTreePeople", () => {
  it("matches names case-insensitively and skips archived people", () => {
    expect(searchTreePeople(people, "ada").map((person) => person.id)).toEqual(["a"]);
    expect(searchTreePeople(people, "stone").map((person) => person.id)).toEqual(["d"]);
    expect(searchTreePeople(people, "archived")).toEqual([]);
    expect(searchTreePeople(people, " ")).toEqual([]);
    expect(searchTreePeople(people, "a", 1)).toHaveLength(1);
  });
});
