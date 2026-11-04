import type { DatePrecision, Person } from "@/lib/supabase/database.types";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function describeDate(
  value: string | null,
  precision: DatePrecision,
): string {
  if (!value || precision === "unknown") return "date unknown";
  const [year, month, day] = value.split("-");

  if (precision === "exact" && month && day) {
    return `${Number(day)} ${months[Number(month) - 1] ?? month} ${year}`;
  }
  if (precision === "month" && month) {
    return `${months[Number(month) - 1] ?? month} ${year}`;
  }
  if (precision === "approximate") {
    return `about ${value}`;
  }
  return year ?? value;
}

export function lifeDates(person: Pick<Person, "birth_date" | "birth_date_precision" | "death_date" | "death_date_precision" | "life_status">): string {
  const birth =
    person.birth_date && person.birth_date_precision !== "unknown"
      ? describeDate(person.birth_date, person.birth_date_precision)
      : null;
  const death =
    person.death_date && person.death_date_precision !== "unknown"
      ? describeDate(person.death_date, person.death_date_precision)
      : null;

  if (!birth && !death) return "Dates unknown";
  if (birth && death) return `${birth} – ${death}`;
  if (birth) {
    return person.life_status === "deceased" ? `${birth} – ?` : `Born ${birth}`;
  }
  return `Died ${death}`;
}
