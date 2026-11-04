import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/navigation";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/families/123?tab=people")).toBe("/families/123?tab=people");
  });

  it("rejects absolute, protocol-relative, and backslash redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/dashboard\nLocation: https://evil.example")).toBe("/dashboard");
  });

  it("falls back for empty values and truncates long paths", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toHaveLength(500);
  });
});
