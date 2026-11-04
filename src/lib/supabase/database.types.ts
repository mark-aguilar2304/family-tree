export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClaimStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type DatePrecision = "exact" | "month" | "year" | "approximate" | "unknown";
export type FamilyRole = "owner" | "admin" | "contributor" | "viewer";
export type GuardianshipType = "legal" | "informal" | "foster" | "other";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type LifeStatus = "living" | "deceased" | "unknown";
export type NameType = "maiden" | "nickname" | "alias" | "previous" | "alternate";
export type ParentageType = "biological" | "adoptive" | "legal" | "foster" | "step";
export type PartnershipStatus =
  | "current"
  | "ended"
  | "divorced"
  | "separated"
  | "widowed"
  | "unknown";
export type PartnershipType = "marriage" | "domestic_partnership" | "other";

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
};
type FamilyRow = {
  id: string;
  name: string;
  description: string | null;
  cover_image_path: string | null;
  owner_id: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
type FamilyMemberRow = {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  joined_at: string;
};
type InvitationRow = {
  id: string;
  family_id: string;
  email: string;
  role: FamilyRole;
  token_hash: string;
  status: InvitationStatus;
  invited_by: string;
  accepted_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};
type PersonRow = {
  id: string;
  family_id: string;
  given_name: string;
  middle_name: string | null;
  surname: string | null;
  suffix: string | null;
  display_name: string;
  gender: string | null;
  biography: string | null;
  birth_date: string | null;
  birth_date_precision: DatePrecision;
  birth_place: string | null;
  death_date: string | null;
  death_date_precision: DatePrecision;
  death_place: string | null;
  life_status: LifeStatus;
  is_claimed: boolean;
  created_by: string;
  updated_by: string;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
type PersonNameRow = {
  id: string;
  family_id: string;
  person_id: string;
  name: string;
  name_type: NameType;
  created_at: string;
};
type ParentageRow = {
  id: string;
  family_id: string;
  parent_id: string;
  child_id: string;
  parentage_type: ParentageType;
  start_date: string | null;
  start_date_precision: DatePrecision;
  end_date: string | null;
  end_date_precision: DatePrecision;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
type PartnershipRow = {
  id: string;
  family_id: string;
  partnership_type: PartnershipType;
  status: PartnershipStatus;
  start_date: string | null;
  start_date_precision: DatePrecision;
  end_date: string | null;
  end_date_precision: DatePrecision;
  location: string | null;
  notes: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
};
type PartnershipParticipantRow = {
  id: string;
  family_id: string;
  partnership_id: string;
  person_id: string;
  participant_role: string | null;
  created_at: string;
};
type GuardianshipRow = {
  id: string;
  family_id: string;
  guardian_id: string;
  ward_id: string;
  guardianship_type: GuardianshipType;
  start_date: string | null;
  start_date_precision: DatePrecision;
  end_date: string | null;
  end_date_precision: DatePrecision;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
type PersonClaimRow = {
  id: string;
  family_id: string;
  person_id: string;
  user_id: string;
  status: ClaimStatus;
  message: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};
type PersonAccountLinkRow = {
  id: string;
  family_id: string;
  person_id: string;
  user_id: string;
  approved_by: string;
  approved_at: string;
  created_at: string;
};
type AuditLogRow = {
  id: string;
  family_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_values: Json | null;
  new_values: Json | null;
  created_at: string;
};
type RateLimitEventRow = {
  id: number;
  key: string;
  created_at: string;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        { id: string; full_name?: string; avatar_path?: string | null },
        { full_name?: string; avatar_path?: string | null }
      >;
      families: Table<
        FamilyRow,
        {
          id?: string;
          name: string;
          description?: string | null;
          cover_image_path?: string | null;
          owner_id: string;
          archived_at?: string | null;
        },
        {
          name?: string;
          description?: string | null;
          cover_image_path?: string | null;
          archived_at?: string | null;
        }
      >;
      family_members: Table<
        FamilyMemberRow,
        { id?: string; family_id: string; user_id: string; role?: FamilyRole },
        { role?: FamilyRole }
      >;
      invitations: Table<
        InvitationRow,
        {
          id?: string;
          family_id: string;
          email: string;
          role: FamilyRole;
          token_hash: string;
          invited_by: string;
          expires_at: string;
        },
        {
          status?: InvitationStatus;
          token_hash?: string;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
        }
      >;
      persons: Table<
        PersonRow,
        {
          id?: string;
          family_id: string;
          given_name?: string;
          middle_name?: string | null;
          surname?: string | null;
          suffix?: string | null;
          display_name: string;
          gender?: string | null;
          biography?: string | null;
          birth_date?: string | null;
          birth_date_precision?: DatePrecision;
          birth_place?: string | null;
          death_date?: string | null;
          death_date_precision?: DatePrecision;
          death_place?: string | null;
          life_status?: LifeStatus;
          created_by: string;
          updated_by: string;
          version?: number;
          archived_at?: string | null;
        },
        {
          given_name?: string;
          middle_name?: string | null;
          surname?: string | null;
          suffix?: string | null;
          display_name?: string;
          gender?: string | null;
          biography?: string | null;
          birth_date?: string | null;
          birth_date_precision?: DatePrecision;
          birth_place?: string | null;
          death_date?: string | null;
          death_date_precision?: DatePrecision;
          death_place?: string | null;
          life_status?: LifeStatus;
          archived_at?: string | null;
          version?: number;
          updated_by?: string;
        }
      >;
      person_names: Table<
        PersonNameRow,
        {
          id?: string;
          family_id: string;
          person_id: string;
          name: string;
          name_type?: NameType;
        },
        { name?: string; name_type?: NameType }
      >;
      parent_child_relationships: Table<
        ParentageRow,
        {
          id?: string;
          family_id: string;
          parent_id: string;
          child_id: string;
          parentage_type?: ParentageType;
          start_date?: string | null;
          start_date_precision?: DatePrecision;
          end_date?: string | null;
          end_date_precision?: DatePrecision;
          notes?: string | null;
          created_by: string;
        },
        {
          parentage_type?: ParentageType;
          start_date?: string | null;
          start_date_precision?: DatePrecision;
          end_date?: string | null;
          end_date_precision?: DatePrecision;
          notes?: string | null;
        }
      >;
      partnerships: Table<
        PartnershipRow,
        {
          id?: string;
          family_id: string;
          partnership_type?: PartnershipType;
          status?: PartnershipStatus;
          start_date?: string | null;
          start_date_precision?: DatePrecision;
          end_date?: string | null;
          end_date_precision?: DatePrecision;
          location?: string | null;
          notes?: string | null;
          created_by: string;
        },
        {
          partnership_type?: PartnershipType;
          status?: PartnershipStatus;
          start_date?: string | null;
          start_date_precision?: DatePrecision;
          end_date?: string | null;
          end_date_precision?: DatePrecision;
          location?: string | null;
          notes?: string | null;
        }
      >;
      partnership_participants: Table<
        PartnershipParticipantRow,
        {
          id?: string;
          family_id: string;
          partnership_id: string;
          person_id: string;
          participant_role?: string | null;
        },
        { participant_role?: string | null }
      >;
      guardianships: Table<
        GuardianshipRow,
        {
          id?: string;
          family_id: string;
          guardian_id: string;
          ward_id: string;
          guardianship_type?: GuardianshipType;
          start_date?: string | null;
          start_date_precision?: DatePrecision;
          end_date?: string | null;
          end_date_precision?: DatePrecision;
          notes?: string | null;
          created_by: string;
        },
        {
          guardianship_type?: GuardianshipType;
          start_date?: string | null;
          start_date_precision?: DatePrecision;
          end_date?: string | null;
          end_date_precision?: DatePrecision;
          notes?: string | null;
        }
      >;
      person_claims: Table<
        PersonClaimRow,
        {
          id?: string;
          family_id: string;
          person_id: string;
          user_id: string;
          message?: string | null;
        },
        { status?: ClaimStatus; resolved_by?: string | null; resolved_at?: string | null }
      >;
      person_account_links: Table<
        PersonAccountLinkRow,
        {
          id?: string;
          family_id: string;
          person_id: string;
          user_id: string;
          approved_by: string;
        },
        never
      >;
      audit_logs: Table<AuditLogRow, never, never>;
      rate_limit_events: Table<RateLimitEventRow, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      create_family: {
        Args: { p_name: string; p_description: string | null };
        Returns: string;
      };
      update_family: {
        Args: { p_family_id: string; p_name: string; p_description: string | null };
        Returns: undefined;
      };
      archive_family: { Args: { p_family_id: string }; Returns: undefined };
      restore_family: { Args: { p_family_id: string }; Returns: undefined };
      transfer_ownership: {
        Args: { p_family_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      leave_family: { Args: { p_family_id: string }; Returns: undefined };
      change_member_role: {
        Args: { p_family_id: string; p_user_id: string; p_role: FamilyRole };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_family_id: string; p_user_id: string };
        Returns: undefined;
      };
      create_invitation: {
        Args: {
          p_family_id: string;
          p_email: string;
          p_role: FamilyRole;
          p_token_hash: string;
          p_expires_at: string;
        };
        Returns: string;
      };
      rotate_invitation: {
        Args: { p_invitation_id: string; p_token_hash: string; p_expires_at: string };
        Returns: undefined;
      };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      list_my_invitations: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          family_id: string;
          family_name: string;
          role: FamilyRole;
          status: InvitationStatus;
          expires_at: string;
          created_at: string;
        }[];
      };
      create_partnership: {
        Args: {
          p_family_id: string;
          p_participant_ids: string[];
          p_partnership_type: PartnershipType;
          p_status: PartnershipStatus;
          p_start_date: string | null;
          p_start_date_precision: DatePrecision;
          p_end_date: string | null;
          p_end_date_precision: DatePrecision;
          p_location: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      add_partnership_participant: {
        Args: {
          p_partnership_id: string;
          p_person_id: string;
          p_participant_role: string | null;
        };
        Returns: string;
      };
      remove_partnership_participant: {
        Args: { p_partnership_id: string; p_person_id: string };
        Returns: undefined;
      };
      request_person_claim: {
        Args: { p_family_id: string; p_person_id: string; p_message: string | null };
        Returns: string;
      };
      resolve_person_claim: {
        Args: { p_claim_id: string; p_approve: boolean };
        Returns: undefined;
      };
      withdraw_person_claim: { Args: { p_claim_id: string }; Returns: undefined };
      search_people: {
        Args: { p_family_id: string; p_query: string; p_limit: number; p_offset: number };
        Returns: PersonRow[];
      };
      family_role: { Args: { p_family_id: string }; Returns: FamilyRole | null };
      is_family_member: { Args: { p_family_id: string }; Returns: boolean };
      is_family_owner: { Args: { p_family_id: string }; Returns: boolean };
      can_edit_family: { Args: { p_family_id: string }; Returns: boolean };
      can_manage_family: { Args: { p_family_id: string }; Returns: boolean };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      claim_status: ClaimStatus;
      date_precision: DatePrecision;
      family_role: FamilyRole;
      guardianship_type: GuardianshipType;
      invitation_status: InvitationStatus;
      life_status: LifeStatus;
      name_type: NameType;
      parentage_type: ParentageType;
      partnership_status: PartnershipStatus;
      partnership_type: PartnershipType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Person = Database["public"]["Tables"]["persons"]["Row"];
export type Family = Database["public"]["Tables"]["families"]["Row"];
export type FamilyMember = Database["public"]["Tables"]["family_members"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
export type PersonName = Database["public"]["Tables"]["person_names"]["Row"];
export type Parentage = Database["public"]["Tables"]["parent_child_relationships"]["Row"];
export type Partnership = Database["public"]["Tables"]["partnerships"]["Row"];
export type PartnershipParticipant =
  Database["public"]["Tables"]["partnership_participants"]["Row"];
export type Guardianship = Database["public"]["Tables"]["guardianships"]["Row"];
export type PersonClaim = Database["public"]["Tables"]["person_claims"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
