import dagre from "@dagrejs/dagre";
import type {
  Parentage,
  Partnership,
  PartnershipParticipant,
  Person,
  ParentageType,
  PartnershipStatus,
  PartnershipType,
} from "@/lib/supabase/database.types";

export const PERSON_NODE_WIDTH = 208;
export const PERSON_NODE_HEIGHT = 104;

export type TreePersonNode = {
  id: string;
  person: Person;
};

export type TreeEdge = {
  id: string;
  source: string;
  target: string;
  kind: "parentage" | "partnership";
  parentageType?: ParentageType;
  partnershipType?: PartnershipType;
  partnershipStatus?: PartnershipStatus;
  label?: string;
  dashed?: boolean;
};

export type TreeGraph = {
  nodes: TreePersonNode[];
  edges: TreeEdge[];
};

export type TreeMode = "all" | "ancestors" | "descendants";

export type TreeLayout = {
  nodes: Array<TreePersonNode & { position: { x: number; y: number } }>;
  edges: TreeEdge[];
};

export function buildTreeGraph(
  people: Person[],
  parentage: Parentage[],
  partnerships: Partnership[],
  participants: PartnershipParticipant[],
): TreeGraph {
  const activePeople = people.filter((person) => !person.archived_at);
  const visible = new Set(activePeople.map((person) => person.id));

  const edges: TreeEdge[] = [];

  for (const edge of parentage) {
    if (
      edge.end_date !== null ||
      !visible.has(edge.parent_id) ||
      !visible.has(edge.child_id)
    ) {
      continue;
    }
    edges.push({
      id: `parentage:${edge.id}`,
      source: edge.parent_id,
      target: edge.child_id,
      kind: "parentage",
      parentageType: edge.parentage_type,
      label: edge.parentage_type === "biological" ? undefined : parentageTypeLabel(edge.parentage_type),
    });
  }

  for (const partnership of partnerships) {
    const group = participants
      .filter(
        (participant) =>
          participant.partnership_id === partnership.id && visible.has(participant.person_id),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

    if (group.length < 2) continue;
    const [primary, ...others] = group;
    others.forEach((other, index) => {
      edges.push({
        id: `partnership:${partnership.id}:${other.person_id}`,
        source: primary.person_id,
        target: other.person_id,
        kind: "partnership",
        partnershipType: partnership.partnership_type,
        partnershipStatus: partnership.status,
        label: index === 0 ? partnershipTypeLabel(partnership.partnership_type) : undefined,
        dashed: partnership.status !== "current",
      });
    });
  }

  return {
    nodes: activePeople.map((person) => ({ id: person.id, person })),
    edges,
  };
}

function parentageTypeLabel(type: ParentageType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function partnershipTypeLabel(type: PartnershipType): string {
  if (type === "domestic_partnership") return "Domestic partnership";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ancestorIds(graph: TreeGraph, personId: string): Set<string> {
  const result = new Set<string>();
  const parents = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "parentage") continue;
    parents.set(edge.target, [...(parents.get(edge.target) ?? []), edge.source]);
  }
  const queue = [...(parents.get(personId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || result.has(id)) continue;
    result.add(id);
    queue.push(...(parents.get(id) ?? []));
  }
  return result;
}

export function descendantIds(graph: TreeGraph, personId: string): Set<string> {
  const result = new Set<string>();
  const children = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "parentage") continue;
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  }
  const queue = [...(children.get(personId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || result.has(id)) continue;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

export function filterTreeByMode(
  graph: TreeGraph,
  focusId: string | null,
  mode: TreeMode,
): TreeGraph {
  if (!focusId || mode === "all") return graph;
  if (!graph.nodes.some((node) => node.id === focusId)) return graph;

  const related =
    mode === "ancestors" ? ancestorIds(graph, focusId) : descendantIds(graph, focusId);
  related.add(focusId);
  return subgraph(graph, related);
}

export function collapseBranches(
  graph: TreeGraph,
  collapsedIds: Set<string>,
): TreeGraph {
  const hidden = new Set<string>();
  for (const id of collapsedIds) {
    for (const descendant of descendantIds(graph, id)) {
      hidden.add(descendant);
    }
  }
  if (hidden.size === 0) return graph;
  const visible = new Set(
    graph.nodes.filter((node) => !hidden.has(node.id)).map((node) => node.id),
  );
  return subgraph(graph, visible);
}

function subgraph(graph: TreeGraph, visibleIds: Set<string>): TreeGraph {
  return {
    nodes: graph.nodes.filter((node) => visibleIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    ),
  };
}

export function layoutTree(graph: TreeGraph): TreeLayout {
  const layout = new dagre.graphlib.Graph();
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({
    rankdir: "TB",
    nodesep: 42,
    ranksep: 104,
    marginx: 32,
    marginy: 32,
  });

  for (const node of graph.nodes) {
    layout.setNode(node.id, {
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
    });
  }
  for (const edge of graph.edges) {
    if (edge.kind === "parentage") layout.setEdge(edge.source, edge.target);
  }

  dagre.layout(layout);

  return {
    nodes: graph.nodes.map((node) => {
      const positioned = layout.node(node.id) as
        | { x: number; y: number; width: number; height: number }
        | undefined;
      return {
        ...node,
        position: positioned
          ? {
              x: positioned.x - positioned.width / 2,
              y: positioned.y - positioned.height / 2,
            }
          : { x: 0, y: 0 },
      };
    }),
    edges: graph.edges,
  };
}

export function countDescendants(graph: TreeGraph, personId: string): number {
  return descendantIds(graph, personId).size;
}

export function searchTreePeople(
  people: Person[],
  query: string,
  limit = 8,
): Person[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return people
    .filter((person) => !person.archived_at)
    .filter(
      (person) =>
        person.display_name.toLowerCase().includes(needle) ||
        `${person.given_name} ${person.surname ?? ""}`.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}
