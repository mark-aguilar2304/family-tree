"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Copy, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, selectClassName } from "@/components/form-field";
import { initialActionState } from "@/lib/errors";
import { createInvitationAction } from "@/lib/actions/invitations";
import { roleLabels } from "@/lib/permissions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Mail /> {pending ? "Creating…" : "Create invitation"}
    </Button>
  );
}

export function InviteMemberForm({
  familyId,
  inviterRole,
}: {
  familyId: string;
  inviterRole: "owner" | "admin" | "contributor" | "viewer";
}) {
  const [state, formAction] = useActionState(createInvitationAction, initialActionState);
  const [copied, setCopied] = useState(false);
  const inviteUrl = state.data?.inviteUrl;

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "success" && (
        <Alert role="status">
          <Check />
          <AlertDescription>
            <p>{state.message}</p>
            {inviteUrl && (
              <div className="mt-3 flex gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  aria-label="Secure invitation link"
                  onFocus={(event) => event.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs">
              Share this link privately. It can be used once and is not shown again.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="familyId" value={familyId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email address" htmlFor="invite-email" required className="sm:col-span-2">
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="relative@example.com"
            autoComplete="off"
          />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <select id="invite-role" name="role" className={selectClassName} defaultValue="contributor">
            <option value="viewer">{roleLabels.viewer}</option>
            <option value="contributor">{roleLabels.contributor}</option>
            {inviterRole === "owner" && <option value="admin">{roleLabels.admin}</option>}
          </select>
        </Field>
        <Field label="Expires" htmlFor="invite-expiry">
          <select id="invite-expiry" name="expiresInDays" className={selectClassName} defaultValue="7">
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </Field>
      </div>
      <Submit />
    </form>
  );
}
