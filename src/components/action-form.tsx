"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/errors";

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: "default" | "sm" | "lg";
  resetOnSuccess?: boolean;
  confirmMessage?: string;
};

function SubmitButton({
  label,
  pendingLabel,
  variant,
  size,
}: {
  label: string;
  pendingLabel: string;
  variant: ActionFormProps["variant"];
  size: ActionFormProps["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className,
  variant = "default",
  size = "default",
  resetOnSuccess = false,
  confirmMessage,
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, {
    status: "idle" as const,
  });

  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state.status === "success" ? state.message : undefined}
      onSubmit={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) event.preventDefault();
            }
          : undefined
      }
    >
      {state.status === "error" && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription>
            <p>{state.message ?? "Something went wrong."}</p>
            {state.fieldErrors && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {Object.entries(state.fieldErrors).map(([field, messages]) =>
                  messages.map((message) => (
                    <li key={`${field}-${message}`}>
                      <span className="font-medium">{field}:</span> {message}
                    </li>
                  )),
                )}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert role="status">
          <CheckCircle2 />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {children}
      <SubmitButton
        label={submitLabel}
        pendingLabel={pendingLabel}
        variant={variant}
        size={size}
      />
    </form>
  );
}
