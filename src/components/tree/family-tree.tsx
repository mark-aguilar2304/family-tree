"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  List,
  LocateFixed,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lifeDates } from "@/lib/dates";
import { lifeStatusLabels } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  buildTreeGraph,
  collapseBranches,
  countDescendants,
  filterTreeByMode,
  layoutTree,
  searchTreePeople,
  type TreeMode,
} from "@/lib/genealogy/tree";
import type {
  Parentage,
  Partnership,
  PartnershipParticipant,
  Person,
} from "@/lib/supabase/database.types";

type PersonNodeData = {
  person: Person;
  selected: boolean;
  descendantCount: number;
  collapsed: boolean;
  onSelect: (personId: string) => void;
  onToggleCollapse: (personId: string) => void;
};

type PersonFlowNode = Node<PersonNodeData, "person">;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const PersonNode = memo(function PersonNode({ data }: NodeProps<PersonFlowNode>) {
  const { person, selected, descendantCount, collapsed, onSelect, onToggleCollapse } = data;
  return (
    <div
      className={cn(
        "relative w-52 rounded-xl border border-border bg-card shadow-sm transition-shadow",
        selected && "border-primary ring-2 ring-primary/25 shadow-md",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="parent"
        isConnectable={false}
        className="!size-2 !border-card !bg-primary/60"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="child"
        isConnectable={false}
        className="!size-2 !border-card !bg-primary/60"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="partner-right"
        isConnectable={false}
        className="!size-2 !border-card !bg-chart-3/80"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="partner-left"
        isConnectable={false}
        className="!size-2 !border-card !bg-chart-3/80"
      />
      <button
        type="button"
        onClick={() => onSelect(person.id)}
        className="block w-full rounded-xl p-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Select ${person.display_name}. ${lifeDates(person)}`}
      >
        <span className="flex items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/8 font-heading text-[11px] font-semibold text-primary">
            {initials(person.display_name) || "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight font-medium">
              {person.display_name}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {lifeDates(person)}
            </span>
          </span>
        </span>
        <span className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              person.life_status === "living"
                ? "bg-primary"
                : person.life_status === "deceased"
                  ? "bg-muted-foreground"
                  : "bg-border",
            )}
            aria-hidden
          />
          <span className="text-[10px] text-muted-foreground">
            {lifeStatusLabels[person.life_status]}
            {person.is_claimed ? " · linked" : ""}
          </span>
        </span>
      </button>
      {descendantCount > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(person.id);
          }}
          className="absolute -right-2 -bottom-2 grid size-5 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={
            collapsed
              ? `Expand ${descendantCount} descendants of ${person.display_name}`
              : `Collapse ${descendantCount} descendants of ${person.display_name}`
          }
          title={collapsed ? "Expand branch" : "Collapse branch"}
        >
          {collapsed ? <Plus className="size-3" /> : <Minus className="size-3" />}
        </button>
      )}
    </div>
  );
});

const nodeTypes = { person: PersonNode };

function edgeStyles(edge: {
  kind: "parentage" | "partnership";
  parentageType?: Parentage["parentage_type"];
  dashed?: boolean;
}): Pick<Edge, "style" | "labelStyle" | "labelBgStyle" | "markerEnd"> {
  if (edge.kind === "partnership") {
    return {
      style: {
        stroke: "var(--chart-3)",
        strokeWidth: 1.5,
        strokeDasharray: edge.dashed ? "5 4" : undefined,
      },
      labelStyle: { fill: "var(--muted-foreground)", fontSize: 10 },
      labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
    };
  }

  const dash =
    edge.parentageType === "biological"
      ? undefined
      : edge.parentageType === "adoptive"
        ? "7 4"
        : edge.parentageType === "legal"
          ? "2 3"
          : edge.parentageType === "foster"
            ? "10 3 2 3"
            : "4 3";

  return {
    style: {
      stroke: "var(--chart-1)",
      strokeWidth: 1.5,
      strokeDasharray: dash,
    },
    labelStyle: { fill: "var(--muted-foreground)", fontSize: 10 },
    labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "var(--chart-1)",
      width: 14,
      height: 14,
    },
  };
}

function TreeCanvas({
  familyId,
  people,
  parentage,
  partnerships,
  participants,
  initialFocusId,
  canEdit,
}: {
  familyId: string;
  people: Person[];
  parentage: Parentage[];
  partnerships: Partnership[];
  participants: PartnershipParticipant[];
  initialFocusId?: string;
  canEdit: boolean;
}) {
  const { fitView } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(initialFocusId ?? null);
  const [focusId, setFocusId] = useState<string | null>(initialFocusId ?? null);
  const [mode, setMode] = useState<TreeMode>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const baseGraph = useMemo(
    () => buildTreeGraph(people, parentage, partnerships, participants),
    [people, parentage, partnerships, participants],
  );
  const selected = useMemo(
    () => people.find((person) => person.id === selectedId) ?? null,
    [people, selectedId],
  );

  const visibleGraph = useMemo(() => {
    const filtered = filterTreeByMode(baseGraph, focusId, mode);
    return collapseBranches(filtered, collapsed);
  }, [baseGraph, focusId, mode, collapsed]);

  const layout = useMemo(() => layoutTree(visibleGraph), [visibleGraph]);
  const searchResults = useMemo(
    () => searchTreePeople(baseGraph.nodes.map((node) => node.person), query),
    [baseGraph, query],
  );

  const toggleCollapse = useCallback((personId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }, []);

  const selectPerson = useCallback((personId: string) => {
    setSelectedId(personId);
  }, []);

  const focusPerson = useCallback(
    (personId: string) => {
      setFocusId(personId);
      setSelectedId(personId);
      setMode("all");
      setCollapsed(new Set());
      setQuery("");
      window.setTimeout(() => {
        void fitView({ nodes: [{ id: personId }], padding: 1.4, duration: 500 });
      }, 60);
    },
    [fitView],
  );

  const changeMode = useCallback(
    (next: TreeMode) => {
      setMode(next);
      setCollapsed(new Set());
      window.setTimeout(() => {
        void fitView({ padding: 0.2, duration: 500 });
      }, 60);
    },
    [fitView],
  );

  const nodes: PersonFlowNode[] = useMemo(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "person",
        position: node.position,
        data: {
          person: node.person,
          selected: node.id === selectedId,
          descendantCount: countDescendants(baseGraph, node.id),
          collapsed: collapsed.has(node.id),
          onSelect: selectPerson,
          onToggleCollapse: toggleCollapse,
        },
      })),
    [layout.nodes, selectedId, baseGraph, collapsed, selectPerson, toggleCollapse],
  );

  const edges: Edge[] = useMemo(
    () =>
      layout.edges.map((edge) => {
        const styles = edgeStyles(edge);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.kind === "partnership" ? "partner-right" : "child",
          targetHandle: edge.kind === "partnership" ? "partner-left" : "parent",
          type: edge.kind === "partnership" ? "straight" : "smoothstep",
          label: edge.label,
          ...styles,
          zIndex: edge.kind === "partnership" ? 1 : 2,
        };
      }),
    [layout.edges],
  );

  const selectedRelationships = useMemo(() => {
    if (!selectedId) return { parents: 0, children: 0, partnerships: 0 };
    return {
      parents: baseGraph.edges.filter(
        (edge) => edge.kind === "parentage" && edge.target === selectedId,
      ).length,
      children: baseGraph.edges.filter(
        (edge) => edge.kind === "parentage" && edge.source === selectedId,
      ).length,
      partnerships: partnerships.filter((partnership) =>
        participants.some(
          (participant) =>
            participant.partnership_id === partnership.id &&
            participant.person_id === selectedId,
        ),
      ).length,
    };
  }, [selectedId, baseGraph, partnerships, participants]);

  const hiddenCount = baseGraph.nodes.length - layout.nodes.length;
  const focusedPerson = people.find((person) => person.id === focusId);

  return (
    <div className="space-y-3">
      <p id="tree-instructions" className="sr-only">
        Family tree canvas. Use the search field to find a person, click a person
        card to open their details, drag to pan, and scroll or use the controls to
        zoom. A text list alternative follows the canvas.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a person…"
            className="pl-9"
            aria-label="Find a person in the tree"
            aria-describedby="tree-instructions"
            aria-expanded={query.length > 0 && searchResults.length > 0}
            aria-controls="tree-search-results"
          />
          {query && (
            <div
              id="tree-search-results"
              role="listbox"
              aria-label="Matching people"
              className="absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
            >
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
              ) : (
                searchResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    role="option"
                    aria-selected={person.id === selectedId}
                    onClick={() => focusPerson(person.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="truncate">{person.display_name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {lifeDates(person)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1" role="group" aria-label="Tree view">
          {(["all", "ancestors", "descendants"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={mode === value ? "default" : "ghost"}
              disabled={value !== "all" && !focusId}
              onClick={() => changeMode(value)}
              className="capitalize"
            >
              {value === "all" ? "All tree" : value}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setCollapsed(new Set());
            window.setTimeout(() => void fitView({ padding: 0.2, duration: 500 }), 60);
          }}
        >
          <LocateFixed /> Fit view
        </Button>
        {collapsed.size > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
        )}
      </div>

      {focusedPerson && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Crosshair className="size-3.5 text-primary" />
          Focused on <span className="font-medium text-foreground">{focusedPerson.display_name}</span>
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => {
              setFocusId(null);
              setMode("all");
              setCollapsed(new Set());
            }}
          >
            Clear focus
          </Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_310px]">
        <div className="relative h-[min(70vh,720px)] min-h-[520px] overflow-hidden rounded-xl border border-border tree-surface">
          {hiddenCount > 0 && (
            <div className="absolute top-3 left-3 z-10 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
              {hiddenCount} {hiddenCount === 1 ? "person" : "people"} hidden by collapsed branches
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.2}
            maxZoom={1.7}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            aria-label="Interactive family tree"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor="var(--primary)"
              maskColor="color-mix(in oklch, var(--background) 82%, transparent)"
              className="!bg-card"
            />
          </ReactFlow>
          <div className="pointer-events-none absolute right-3 bottom-3 z-10 hidden rounded-lg border border-border bg-background/90 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground shadow-sm sm:block">
            <p className="flex items-center gap-2">
              <span className="h-px w-6 bg-chart-1" /> Parentage
            </p>
            <p className="flex items-center gap-2">
              <span className="h-px w-6 border-t border-dashed border-chart-1" /> Other parentage
            </p>
            <p className="flex items-center gap-2">
              <span className="h-px w-6 bg-chart-3" /> Partnership
            </p>
            <p className="flex items-center gap-2">
              <span className="h-px w-6 border-t border-dashed border-chart-3" /> Ended
            </p>
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-card">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    Selected person
                  </p>
                  <h2 className="mt-1 font-heading text-xl font-medium">
                    {selected.display_name}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{lifeDates(selected)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close person details"
                >
                  <X />
                </Button>
              </div>
              <div className="space-y-4 p-4 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{lifeStatusLabels[selected.life_status]}</Badge>
                  {selected.is_claimed && <Badge variant="secondary">Linked account</Badge>}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <dt className="text-[10px] text-muted-foreground">Parents</dt>
                    <dd className="font-heading text-lg">{selectedRelationships.parents}</dd>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <dt className="text-[10px] text-muted-foreground">Children</dt>
                    <dd className="font-heading text-lg">{selectedRelationships.children}</dd>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <dt className="text-[10px] text-muted-foreground">Partners</dt>
                    <dd className="font-heading text-lg">{selectedRelationships.partnerships}</dd>
                  </div>
                </dl>
                {selected.biography && (
                  <p className="line-clamp-5 text-xs leading-relaxed text-muted-foreground">
                    {selected.biography}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <Button asChild size="sm">
                    <Link href={`/families/${familyId}/people/${selected.id}`}>
                      Open full profile
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => focusPerson(selected.id)}
                  >
                    <Crosshair /> Focus and center
                  </Button>
                  {selectedRelationships.children > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCollapse(selected.id)}
                    >
                      {collapsed.has(selected.id) ? <ChevronDown /> : <ChevronUp />}
                      {collapsed.has(selected.id) ? "Expand branch" : "Collapse branch"}
                    </Button>
                  )}
                  {canEdit && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/families/${familyId}/people/${selected.id}/edit`}>
                        Edit profile
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary/8 text-primary">
                <Crosshair className="size-5" />
              </span>
              <h2 className="mt-4 font-heading text-lg font-medium">Select a person</h2>
              <p className="mt-2 max-w-56 text-xs leading-relaxed text-muted-foreground">
                Choose a card to see their details, or search to focus the tree on
                someone.
              </p>
            </div>
          )}
        </aside>
      </div>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <List className="size-4 text-primary" /> Text list of people in this view
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          An accessible alternative to the canvas. {layout.nodes.length} people shown.
        </p>
        <ul className="mt-3 divide-y divide-border/70">
          {layout.nodes.map((node) => (
            <li key={node.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link
                href={`/families/${familyId}/people/${node.id}`}
                className="font-medium underline-offset-4 hover:text-primary hover:underline"
              >
                {node.person.display_name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {lifeDates(node.person)} · {lifeStatusLabels[node.person.life_status]}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function FamilyTree(props: {
  familyId: string;
  people: Person[];
  parentage: Parentage[];
  partnerships: Partnership[];
  participants: PartnershipParticipant[];
  initialFocusId?: string;
  canEdit: boolean;
}) {
  return (
    <ReactFlowProvider>
      <TreeCanvas {...props} />
    </ReactFlowProvider>
  );
}
