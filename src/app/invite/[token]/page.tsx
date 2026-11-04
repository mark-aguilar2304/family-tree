import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { acceptInvitationAction } from "@/lib/actions/invitations";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await requireUser(`/invite/${token}`);

  return (
    <main className="grid min-h-svh place-items-center paper-grain px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Brand />
        </div>
        <Card className="mt-6">
          <CardHeader>
            <span className="grid size-11 place-items-center rounded-full bg-primary/8 text-primary">
              <LockKeyhole className="size-5" />
            </span>
            <CardTitle className="mt-3 text-2xl">You have been invited</CardTitle>
            <CardDescription>
              Accepting adds this private family workspace to your account. The
              invitation is single-use and checked against your email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
            <ActionForm
              action={acceptInvitationAction}
              submitLabel="Accept invitation"
              pendingLabel="Joining…"
              className="space-y-3"
            >
              <input type="hidden" name="token" value={token} />
            </ActionForm>
            <p className="text-xs text-muted-foreground">
              Invited with a different address?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Sign in with that account
              </Link>{" "}
              and reopen your invitation link.
            </p>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/dashboard">
                Go to your workspaces <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
