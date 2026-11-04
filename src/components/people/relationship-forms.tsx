import { ActionForm } from "@/components/action-form";
import { Field, selectClassName } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  datePrecisionLabels,
  datePrecisionPlaceholders,
  guardianshipTypeLabels,
  parentageLabels,
  partnershipStatusLabels,
  partnershipTypeLabels,
} from "@/lib/permissions";
import type { Person } from "@/lib/supabase/database.types";
import {
  createGuardianshipAction,
  createParentageAction,
  createPartnershipAction,
  endGuardianshipAction,
  endParentageAction,
  updatePartnershipStatusAction,
} from "@/lib/actions/relationships";

const precisions = ["unknown", "exact", "month", "year", "approximate"] as const;
const endPrecisions = ["exact", "month", "year", "approximate"] as const;

function PersonOptions({
  people,
  excludeId,
}: {
  people: Person[];
  excludeId: string;
}) {
  return (
    <>
      <option value="">Choose a person…</option>
      {people
        .filter((person) => person.id !== excludeId && !person.archived_at)
        .map((person) => (
          <option key={person.id} value={person.id}>
            {person.display_name}
          </option>
        ))}
    </>
  );
}

function DateFields({ prefix = "" }: { prefix?: string }) {
  return (
    <>
      <Field label="Start date" htmlFor={`${prefix}startDate`}>
        <Input
          id={`${prefix}startDate`}
          name="startDate"
          maxLength={10}
          placeholder="1954 or 1954-06"
        />
      </Field>
      <Field label="Start precision" htmlFor={`${prefix}startDatePrecision`}>
        <select
          id={`${prefix}startDatePrecision`}
          name="startDatePrecision"
          className={selectClassName}
          defaultValue="unknown"
        >
          {precisions.map((precision) => (
            <option key={precision} value={precision}>
              {datePrecisionLabels[precision]} — {datePrecisionPlaceholders[precision]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="End date" htmlFor={`${prefix}endDate`} hint="Optional. Leave blank if ongoing.">
        <Input id={`${prefix}endDate`} name="endDate" maxLength={10} placeholder="1988" />
      </Field>
      <Field label="End precision" htmlFor={`${prefix}endDatePrecision`}>
        <select
          id={`${prefix}endDatePrecision`}
          name="endDatePrecision"
          className={selectClassName}
          defaultValue="unknown"
        >
          {precisions.map((precision) => (
            <option key={precision} value={precision}>
              {datePrecisionLabels[precision]} — {datePrecisionPlaceholders[precision]}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

export function AddParentageForm({
  familyId,
  person,
  people,
  mode,
}: {
  familyId: string;
  person: Person;
  people: Person[];
  mode: "parent" | "child";
}) {
  return (
    <ActionForm
      action={createParentageAction}
      submitLabel={mode === "parent" ? "Add parent" : "Add child"}
      pendingLabel="Saving…"
      className="space-y-4 rounded-lg border border-border bg-background/60 p-4"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="personId" value={person.id} />
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={mode === "parent" ? "Parent" : "Child"} htmlFor={`${mode}-relative`} required>
          <select
            id={`${mode}-relative`}
            name="relativeId"
            className={selectClassName}
            required
          >
            <PersonOptions people={people} excludeId={person.id} />
          </select>
        </Field>
        <Field label="Parentage type" htmlFor={`${mode}-parentage-type`}>
          <select
            id={`${mode}-parentage-type`}
            name="parentageType"
            className={selectClassName}
            defaultValue="biological"
          >
            {Object.entries(parentageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <DateFields prefix={`${mode}-`} />
        <Field label="Notes" htmlFor={`${mode}-notes`} className="sm:col-span-2">
          <Textarea id={`${mode}-notes`} name="notes" rows={2} maxLength={2000} />
        </Field>
      </div>
    </ActionForm>
  );
}

export function AddPartnershipForm({
  familyId,
  person,
  people,
}: {
  familyId: string;
  person: Person;
  people: Person[];
}) {
  return (
    <ActionForm
      action={createPartnershipAction}
      submitLabel="Add partnership"
      pendingLabel="Saving…"
      className="space-y-4 rounded-lg border border-border bg-background/60 p-4"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="personId" value={person.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Partner" htmlFor="partnerId" required>
          <select id="partnerId" name="partnerId" className={selectClassName} required>
            <PersonOptions people={people} excludeId={person.id} />
          </select>
        </Field>
        <Field label="Partnership type" htmlFor="partnershipType">
          <select
            id="partnershipType"
            name="partnershipType"
            className={selectClassName}
            defaultValue="marriage"
          >
            {Object.entries(partnershipTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="partnershipStatus">
          <select
            id="partnershipStatus"
            name="status"
            className={selectClassName}
            defaultValue="current"
          >
            {Object.entries(partnershipStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location" htmlFor="partnershipLocation">
          <Input id="partnershipLocation" name="location" maxLength={200} />
        </Field>
        <DateFields prefix="partnership-" />
        <Field label="Notes" htmlFor="partnershipNotes" className="sm:col-span-2">
          <Textarea id="partnershipNotes" name="notes" rows={2} maxLength={2000} />
        </Field>
      </div>
    </ActionForm>
  );
}

export function AddGuardianshipForm({
  familyId,
  person,
  people,
}: {
  familyId: string;
  person: Person;
  people: Person[];
}) {
  return (
    <ActionForm
      action={createGuardianshipAction}
      submitLabel="Add guardianship"
      pendingLabel="Saving…"
      className="space-y-4 rounded-lg border border-border bg-background/60 p-4"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="personId" value={person.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Person" htmlFor="guardianRelative" required>
          <select id="guardianRelative" name="relativeId" className={selectClassName} required>
            <PersonOptions people={people} excludeId={person.id} />
          </select>
        </Field>
        <Field label="Direction" htmlFor="guardianshipDirection">
          <select
            id="guardianshipDirection"
            name="direction"
            className={selectClassName}
            defaultValue="guardian"
          >
            <option value="guardian">This person is the guardian</option>
            <option value="ward">This person is the ward</option>
          </select>
        </Field>
        <Field label="Guardianship type" htmlFor="guardianshipType">
          <select
            id="guardianshipType"
            name="guardianshipType"
            className={selectClassName}
            defaultValue="legal"
          >
            {Object.entries(guardianshipTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <DateFields prefix="guardianship-" />
        <Field label="Notes" htmlFor="guardianshipNotes" className="sm:col-span-2">
          <Textarea id="guardianshipNotes" name="notes" rows={2} maxLength={2000} />
        </Field>
      </div>
    </ActionForm>
  );
}

export function EndParentageForm({
  familyId,
  personId,
  recordId,
}: {
  familyId: string;
  personId: string;
  recordId: string;
}) {
  return (
    <ActionForm
      action={endParentageAction}
      submitLabel="End record"
      pendingLabel="Ending…"
      variant="outline"
      size="sm"
      className="mt-2 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="recordId" value={recordId} />
      <Field label="End date" htmlFor={`end-parentage-${recordId}`}>
        <Input
          id={`end-parentage-${recordId}`}
          name="endDate"
          maxLength={10}
          required
          placeholder="1988"
          className="w-28"
        />
      </Field>
      <Field label="Precision" htmlFor={`end-parentage-precision-${recordId}`}>
        <select
          id={`end-parentage-precision-${recordId}`}
          name="endDatePrecision"
          className={`${selectClassName} w-36`}
          defaultValue="year"
        >
          {endPrecisions.map((precision) => (
            <option key={precision} value={precision}>
              {datePrecisionLabels[precision]}
            </option>
          ))}
        </select>
      </Field>
    </ActionForm>
  );
}

export function UpdatePartnershipForm({
  familyId,
  personId,
  partnershipId,
  currentStatus,
}: {
  familyId: string;
  personId: string;
  partnershipId: string;
  currentStatus: string;
}) {
  return (
    <ActionForm
      action={updatePartnershipStatusAction}
      submitLabel="Update partnership"
      pendingLabel="Updating…"
      variant="outline"
      size="sm"
      className="mt-2 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="partnershipId" value={partnershipId} />
      <Field label="Status" htmlFor={`partnership-status-${partnershipId}`}>
        <select
          id={`partnership-status-${partnershipId}`}
          name="status"
          className={`${selectClassName} w-36`}
          defaultValue={currentStatus}
        >
          {Object.entries(partnershipStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="End date" htmlFor={`partnership-end-${partnershipId}`}>
        <Input
          id={`partnership-end-${partnershipId}`}
          name="endDate"
          maxLength={10}
          placeholder="1988"
          className="w-28"
        />
      </Field>
      <Field label="Precision" htmlFor={`partnership-end-precision-${partnershipId}`}>
        <select
          id={`partnership-end-precision-${partnershipId}`}
          name="endDatePrecision"
          className={`${selectClassName} w-36`}
          defaultValue="unknown"
        >
          {precisions.map((precision) => (
            <option key={precision} value={precision}>
              {datePrecisionLabels[precision]}
            </option>
          ))}
        </select>
      </Field>
    </ActionForm>
  );
}

export function EndGuardianshipForm({
  familyId,
  personId,
  recordId,
}: {
  familyId: string;
  personId: string;
  recordId: string;
}) {
  return (
    <ActionForm
      action={endGuardianshipAction}
      submitLabel="End record"
      pendingLabel="Ending…"
      variant="outline"
      size="sm"
      className="mt-2 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="recordId" value={recordId} />
      <Field label="End date" htmlFor={`end-guardian-${recordId}`}>
        <Input
          id={`end-guardian-${recordId}`}
          name="endDate"
          maxLength={10}
          required
          placeholder="2015"
          className="w-28"
        />
      </Field>
      <Field label="Precision" htmlFor={`end-guardian-precision-${recordId}`}>
        <select
          id={`end-guardian-precision-${recordId}`}
          name="endDatePrecision"
          className={`${selectClassName} w-36`}
          defaultValue="year"
        >
          {endPrecisions.map((precision) => (
            <option key={precision} value={precision}>
              {datePrecisionLabels[precision]}
            </option>
          ))}
        </select>
      </Field>
    </ActionForm>
  );
}
