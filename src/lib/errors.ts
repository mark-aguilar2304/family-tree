export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: Record<string, string>;
};

export const initialActionState: ActionState = { status: "idle" };

export function actionError(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionState {
  return { status: "error", message, fieldErrors };
}

export function actionSuccess(message?: string): ActionState {
  return { status: "success", message };
}

const domainMessages: Record<string, string> = {
  not_authenticated: "Please sign in again.",
  not_authorized: "You do not have permission to do that.",
  not_a_member: "You are not a member of this workspace.",
  already_member: "That person is already a member.",
  owner_must_transfer: "Transfer ownership before leaving this workspace.",
  owner_role_requires_transfer: "Ownership can only change through a transfer.",
  cannot_change_owner: "The owner's role cannot be changed here.",
  cannot_change_own_role: "You cannot change your own role.",
  cannot_remove_owner: "The owner cannot be removed.",
  cannot_remove_self: "You cannot remove yourself.",
  admin_role_change_limited: "Admins cannot change other admin roles.",
  admin_remove_limited: "Admins cannot remove other admins.",
  admin_cannot_invite_admin: "Admins cannot invite another admin.",
  already_owner: "You already own this workspace.",
  target_not_member: "That person is not a member of this workspace.",
  invitation_exists: "A pending invitation already exists for that email.",
  invitation_not_found: "That invitation no longer exists.",
  invitation_not_pending: "That invitation is no longer pending.",
  invitation_used: "This invitation has already been used.",
  invitation_revoked: "This invitation has been revoked.",
  invitation_expired: "This invitation has expired.",
  invitation_email_mismatch: "Sign in with the email address that was invited.",
  invalid_invitation: "This invitation link is not valid.",
  workspace_archived: "This workspace is archived and read-only.",
  person_not_found: "That person was not found in this workspace.",
  person_archived: "That person is archived.",
  self_parentage: "A person cannot be their own parent.",
  ancestry_cycle: "That parentage would create a loop in the family tree.",
  cross_workspace_relationship: "Both people must belong to this workspace.",
  duplicate_relationship: "That relationship already exists.",
  parentage_identity_immutable: "Parentage records cannot be moved.",
  self_guardianship: "A person cannot be their own guardian.",
  guardianship_identity_immutable: "Guardianship records cannot be moved.",
  partnership_requires_two_participants: "A partnership needs at least two people.",
  partnership_not_found: "That partnership was not found.",
  person_already_claimed: "That person is already linked to an account.",
  account_already_linked_in_workspace:
    "Your account is already linked to someone in this workspace.",
  claim_already_pending: "You already have a pending claim for that person.",
  claim_requires_living_person: "Only living people can be claimed.",
  claim_not_found: "That claim was not found.",
  claim_not_pending: "That claim has already been resolved.",
  claim_user_mismatch: "You can only claim a profile for your own account.",
  restore_requires_manager: "Only an owner or admin can restore this person.",
  person_identity_immutable: "A person cannot be moved to another workspace.",
  claim_flag_managed: "Claim status is managed through claim approval.",
  family_owner_consistency: "The workspace must always have exactly one owner.",
  invalid_email: "Enter a valid email address.",
  invalid_token_hash: "The invitation token was invalid. Please try again.",
  invalid_expiry: "Choose an expiry within the next 30 days.",
  invalid_family_name: "Enter a workspace name of 120 characters or fewer.",
  invalid_family_description: "The description is too long.",
  version_conflict: "Someone else changed this record. Reload and try again.",
};

const domainCodes = Object.keys(domainMessages).sort(
  (a, b) => b.length - a.length,
);

export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const message = error instanceof Error ? error.message : String(error);
  const domain = domainCodes.find((code) => message.includes(code));
  if (domain) return domainMessages[domain];

  if (/duplicate key|unique constraint/i.test(message)) {
    return "That record already exists.";
  }
  if (/row-level security/i.test(message)) {
    return "You do not have permission to do that.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return fallback;
}
