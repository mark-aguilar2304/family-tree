import { describe, expect, it } from "vitest";
import { canEdit, canManage, isOwner } from "@/lib/permissions";

describe("workspace permissions", () => {
  it("allows owners, admins, and contributors to edit content", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("admin")).toBe(true);
    expect(canEdit("contributor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
  });

  it("restricts member management to owners and admins", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("admin")).toBe(true);
    expect(canManage("contributor")).toBe(false);
    expect(canManage("viewer")).toBe(false);
  });

  it("only treats the owner role as ownership", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("admin")).toBe(false);
  });
});
