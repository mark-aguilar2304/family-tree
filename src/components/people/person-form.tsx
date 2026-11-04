import { ActionForm } from "@/components/action-form";
import { Field, FormSection, selectClassName } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  datePrecisionLabels,
  datePrecisionPlaceholders,
  lifeStatusLabels,
} from "@/lib/permissions";
import type { Person } from "@/lib/supabase/database.types";
import type { ActionState } from "@/lib/errors";

const precisions = ["unknown", "exact", "month", "year", "approximate"] as const;
const lifeStatuses = ["living", "deceased", "unknown"] as const;

export function PersonForm({
  action,
  familyId,
  person,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  familyId: string;
  person?: Person;
  submitLabel: string;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      pendingLabel="Saving…"
      className="space-y-8"
    >
      <input type="hidden" name="familyId" value={familyId} />
      {person && (
        <>
          <input type="hidden" name="personId" value={person.id} />
          <input type="hidden" name="version" value={person.version} />
        </>
      )}

      <FormSection
        title="Identity"
        description="Only a display name is required. Record what is known and leave the rest open."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="displayName" required className="sm:col-span-2">
            <Input
              id="displayName"
              name="displayName"
              required
              maxLength={200}
              defaultValue={person?.display_name}
              placeholder="Elena Rivera Hernández"
            />
          </Field>
          <Field label="Given name" htmlFor="givenName">
            <Input
              id="givenName"
              name="givenName"
              maxLength={120}
              defaultValue={person?.given_name}
            />
          </Field>
          <Field label="Middle name" htmlFor="middleName">
            <Input
              id="middleName"
              name="middleName"
              maxLength={120}
              defaultValue={person?.middle_name ?? ""}
            />
          </Field>
          <Field label="Surname" htmlFor="surname">
            <Input
              id="surname"
              name="surname"
              maxLength={120}
              defaultValue={person?.surname ?? ""}
            />
          </Field>
          <Field label="Suffix" htmlFor="suffix" hint="For example: Jr., III, or a title.">
            <Input
              id="suffix"
              name="suffix"
              maxLength={30}
              defaultValue={person?.suffix ?? ""}
            />
          </Field>
          <Field label="Gender" htmlFor="gender" hint="Optional and free-form.">
            <Input
              id="gender"
              name="gender"
              maxLength={60}
              defaultValue={person?.gender ?? ""}
            />
          </Field>
          <Field label="Life status" htmlFor="lifeStatus">
            <select
              id="lifeStatus"
              name="lifeStatus"
              className={selectClassName}
              defaultValue={person?.life_status ?? "unknown"}
            >
              {lifeStatuses.map((status) => (
                <option key={status} value={status}>
                  {lifeStatusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Biography" htmlFor="biography" className="sm:col-span-2">
            <Textarea
              id="biography"
              name="biography"
              rows={5}
              maxLength={10000}
              defaultValue={person?.biography ?? ""}
              placeholder="Stories, occupation, places lived, and details worth preserving."
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Birth"
        description="Dates keep their precision. An approximate year is never treated as an exact date."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Birth date" htmlFor="birthDate">
            <Input
              id="birthDate"
              name="birthDate"
              maxLength={10}
              defaultValue={person?.birth_date ?? ""}
              placeholder="1934 or 1934-05-12"
              aria-describedby="birthDate-hint"
            />
            <p id="birthDate-hint" className="text-xs text-muted-foreground">
              Match the format to the precision selected below.
            </p>
          </Field>
          <Field label="Date precision" htmlFor="birthDatePrecision">
            <select
              id="birthDatePrecision"
              name="birthDatePrecision"
              className={selectClassName}
              defaultValue={person?.birth_date_precision ?? "unknown"}
            >
              {precisions.map((precision) => (
                <option key={precision} value={precision}>
                  {datePrecisionLabels[precision]} — {datePrecisionPlaceholders[precision]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Birth place" htmlFor="birthPlace">
            <Input
              id="birthPlace"
              name="birthPlace"
              maxLength={200}
              defaultValue={person?.birth_place ?? ""}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Death" description="Leave blank when unknown or still living.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Death date" htmlFor="deathDate">
            <Input
              id="deathDate"
              name="deathDate"
              maxLength={10}
              defaultValue={person?.death_date ?? ""}
            />
          </Field>
          <Field label="Date precision" htmlFor="deathDatePrecision">
            <select
              id="deathDatePrecision"
              name="deathDatePrecision"
              className={selectClassName}
              defaultValue={person?.death_date_precision ?? "unknown"}
            >
              {precisions.map((precision) => (
                <option key={precision} value={precision}>
                  {datePrecisionLabels[precision]} — {datePrecisionPlaceholders[precision]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Death place" htmlFor="deathPlace">
            <Input
              id="deathPlace"
              name="deathPlace"
              maxLength={200}
              defaultValue={person?.death_place ?? ""}
            />
          </Field>
        </div>
      </FormSection>
    </ActionForm>
  );
}
