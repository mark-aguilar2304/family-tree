import { describe, expect, it } from "vitest";
import { deriveSiblings, siblingLabel } from "@/lib/genealogy/kinship";
import { makeParentage, makePerson } from "./fixtures";

const person = makePerson("me", { display_name: "Me" });
const people = [
  person,
  makePerson("full", { display_name: "Full" }),
  makePerson("half", { display_name: "Half" }),
  makePerson("shared", { display_name: "Shared" }),
  makePerson("stranger", { display_name: "Stranger" }),
  makePerson("archived", {
    display_name: "Archived",
    archived_at: "2026-01-02T00:00:00.000Z",
  }),
];

const parentage = [
  makeParentage("me-a", "a", "me"),
  makeParentage("me-b", "b", "me"),
  makeParentage("full-a", "a", "full"),
  makeParentage("full-b", "b", "full"),
  makeParentage("half-a", "a", "half"),
  makeParentage("half-c", "c", "half"),
  makeParentage("shared-a", "a", "shared"),
  makeParentage("stranger-c", "c", "stranger"),
  makeParentage("stranger-d", "d", "stranger"),
  makeParentage("archived-a", "a", "archived"),
  makeParentage("archived-b", "b", "archived"),
  makeParentage("ended", "a", "ended", { end_date: "2020-01-01" }),
];

describe("deriveSiblings", () => {
  it("distinguishes full, half, and uncertain shared siblings", () => {
    const siblings = deriveSiblings("me", parentage, [
      ...people,
      makePerson("ended", { display_name: "Ended" }),
    ]);

    expect(siblings.map((sibling) => [sibling.person.id, sibling.kind])).toEqual([
      ["full", "full"],
      ["half", "half"],
      ["shared", "shared"],
    ]);
  });

  it("uses a general label when only one parent is known", () => {
    expect(siblingLabel("full")).toBe("Full sibling");
    expect(siblingLabel("half")).toBe("Half sibling");
    expect(siblingLabel("shared")).toBe("Sibling");
  });

  it("ignores ended parentage and people without shared parents", () => {
    const siblings = deriveSiblings("me", parentage, people);

    expect(siblings.some((sibling) => sibling.person.id === "ended")).toBe(false);
    expect(siblings.some((sibling) => sibling.person.id === "stranger")).toBe(false);
  });

  it("returns no siblings when the person has no active parents", () => {
    expect(
      deriveSiblings("orphan", parentage, [...people, makePerson("orphan")]),
    ).toEqual([]);
  });

  it("sorts siblings by display name", () => {
    const siblings = deriveSiblings("me", parentage, people);

    expect(siblings.map((sibling) => sibling.person.display_name)).toEqual([
      "Full",
      "Half",
      "Shared",
    ]);
  });
});
