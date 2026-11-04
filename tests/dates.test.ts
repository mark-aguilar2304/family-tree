import { describe, expect, it } from "vitest";
import { describeDate, lifeDates } from "@/lib/dates";

describe("describeDate", () => {
  it("formats dates according to their precision", () => {
    expect(describeDate("1994-03-18", "exact")).toBe("18 Mar 1994");
    expect(describeDate("1994-03", "month")).toBe("Mar 1994");
    expect(describeDate("1994", "year")).toBe("1994");
    expect(describeDate("1994-03", "approximate")).toBe("about 1994-03");
    expect(describeDate("1994", "unknown")).toBe("date unknown");
    expect(describeDate(null, "exact")).toBe("date unknown");
  });
});

describe("lifeDates", () => {
  const base = {
    birth_date: null,
    birth_date_precision: "unknown" as const,
    death_date: null,
    death_date_precision: "unknown" as const,
    life_status: "unknown" as const,
  };

  it("joins birth and death dates", () => {
    expect(
      lifeDates({
        ...base,
        birth_date: "1994-03-18",
        birth_date_precision: "exact",
        death_date: "2020-01-02",
        death_date_precision: "exact",
      }),
    ).toBe("18 Mar 1994 – 2 Jan 2020");
  });

  it("marks a deceased person with no known death date", () => {
    expect(
      lifeDates({
        ...base,
        birth_date: "1994",
        birth_date_precision: "year",
        life_status: "deceased",
      }),
    ).toBe("1994 – ?");
  });

  it("shows only the parts that are known", () => {
    expect(
      lifeDates({
        ...base,
        birth_date: "1994",
        birth_date_precision: "year",
        life_status: "living",
      }),
    ).toBe("Born 1994");
    expect(
      lifeDates({
        ...base,
        death_date: "2020",
        death_date_precision: "year",
        life_status: "deceased",
      }),
    ).toBe("Died 2020");
    expect(lifeDates(base)).toBe("Dates unknown");
  });
});
