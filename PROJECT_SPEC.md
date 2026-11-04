# Collaborative Family Genealogy Platform
## Product Requirements, Technical Architecture, and LLM Build Guide

> **Document purpose:** This document is the product and engineering brief for an LLM coding agent. Use it as the source of truth when planning, implementing, testing, and refining the application.
>
> **Working product name:** FamilyTree (placeholder; choose a better name later if desired).
>
> **Product direction:** A private, invitation-only, collaborative genealogy platform.

---

# Part I — Product Definition

## 1. Product vision

Build a web application that allows families to collaboratively create, maintain, explore, and preserve a shared family tree. Members can add people, record biographical information, define complex family relationships, upload historical materials, and explore connections through an interactive visualization.

The application is not merely a diagramming tool. It is a structured genealogy system in which the database is the source of truth and the family tree visualization is one way to explore the underlying information.

### 1.1 Product goals

1. Let an authorized user create a private family workspace.
2. Let the workspace owner invite relatives and assign access roles.
3. Let authorized members add and maintain individual profiles.
4. Support complex family structures, including biological, adoptive, legal, foster, and step-parent relationships, partnerships, and guardianships.
5. Display family connections in a clear, interactive tree.
6. Preserve family history through events, photographs, documents, and sources.
7. Track important changes and help resolve conflicting information.
8. Protect private family data, especially information about living people.

### 1.2 Target users

| Role | Description |
|---|---|
| Owner | Creates the workspace and has full control, including ownership transfer and workspace deletion. |
| Administrator | Manages members, invitations, and family information. |
| Contributor | Adds and edits people, relationships, events, and media according to workspace permissions. |
| Viewer | Can view the family tree and permitted profile information but cannot modify records. |

### 1.3 Product principles

- **Privacy first:** Workspaces are private and invitation-only.
- **People are records, not accounts:** A person can exist in the genealogy database without having a login.
- **Relationships are explicit data:** Do not infer every relationship from names or visual placement.
- **Evidence matters:** Support sources and uncertainty instead of treating every fact as unquestionably true.
- **Visualization is derived:** Never make the graph UI the authoritative store of relationship data.
- **Accessible and understandable:** Keep common tasks simple for non-technical family members.
- **Incremental delivery:** Build a working core before advanced genealogy features.

---

# Part II — Product Requirements

## 2. Workspace management

A workspace represents one unified family tree. A workspace can contain many branches and generations, but those branches belong to the same tree.

A user may participate in multiple workspaces with different roles.

### Functional requirements

- Create a workspace with a name, description, and optional cover image.
- View and switch between workspaces the user belongs to.
- Edit workspace details according to role.
- Invite relatives by email.
- Assign a role to an invitee.
- View pending, accepted, expired, and revoked invitations.
- Revoke pending invitations.
- Remove members according to role permissions.
- Transfer ownership.
- Archive or delete a workspace with appropriate confirmation.

### Acceptance criteria

- A newly created workspace is private by default.
- Only authenticated members can access workspace data.
- A user cannot access a workspace by guessing or changing its URL.
- A user can belong to more than one workspace.
- A workspace cannot be left without an owner.

## 3. Authentication and membership

Use an authentication provider. Do not implement password storage manually.

### Functional requirements

- Sign up, sign in, sign out, and password recovery.
- Maintain authenticated sessions.
- Invite users who already have accounts or need to register.
- Accept invitations only through valid, unexpired, non-revoked tokens.
- Prevent duplicate active memberships in the same workspace.
- Allow an invited user to join multiple workspaces.

### Invitation lifecycle

`pending -> accepted`

Other terminal or administrative states:

- `expired`
- `revoked`

Invitation tokens must be cryptographically random, stored as hashes, expire after a configurable period, and be single-use.

## 4. Individual/person management

Each person is a genealogy record, independent of whether they have a user account.

### Suggested profile fields

| Group | Fields |
|---|---|
| Identity | Given/first name, middle name, surname, suffix, display name |
| Additional names | Maiden name, nickname, alias, previous name, alternative spelling |
| Personal | Gender (optional), biography, occupation |
| Birth | Date, date precision, place |
| Death | Date, date precision, place, living/deceased/unknown status |
| Media | Profile image and related photographs |
| Administration | Created by, updated by, timestamps, record version |

Do not require users to know every field. Unknown and incomplete information must be supported.

### Date precision

Support at least:

- Exact date
- Month known
- Year known
- Approximate date
- Unknown

Do not silently convert an approximate year into an exact date. Preserve the precision metadata.

### Functional requirements

- Create, view, edit, and archive/delete a person, subject to permissions.
- Search by display name and alternative names.
- Add multiple names.
- View a person's relationships and life events.
- Attach sources to facts where possible.
- View the record's change history.
- Prevent accidental duplicate records where possible.

### Person/account linking

A person record may optionally be linked to a user account when a living family member claims or verifies that profile. Keep this as an optional association, not a requirement for creating a person.

Do not automatically expose a person's private account information through their genealogy profile.

## 5. Relationship management

Relationship modeling is a core domain requirement. Do not implement the data model as only `father_id` and `mother_id` fields on a person.

Use separate relationship entities.

### 5.1 Parentage

Represent parent-child relationships explicitly. Support relationship types such as:

- Biological
- Adoptive
- Legal
- Foster
- Step

A child may have multiple parentage records. The model must not assume exactly one mother and one father.

### 5.2 Partnerships

Represent partnerships independently from parentage.

Support types/statuses such as:

- Marriage
- Domestic partnership
- Other partnership
- Current
- Ended
- Divorced
- Separated
- Widowed
- Unknown

A partnership may have start/end dates, location, notes, and supporting sources. Model participants separately so the relationship entity is extensible.

### 5.3 Guardianship

Represent guardianship independently from parentage. A guardian is not automatically a biological or legal parent.

Support guardian, ward, type, start/end dates, notes, and sources.

### 5.4 Siblings and other calculated relationships

Prefer deriving sibling relationships from shared parentage rather than storing redundant sibling edges. Distinguish full siblings, half-siblings, and other sibling relationships based on the shared parentage data.

The system may calculate other kinship relationships from graph paths. Do not hard-code every possible relationship as a manually stored edge.

### 5.5 Validation rules

Enforce, at minimum:

- A person cannot be their own parent, guardian, or partnership participant with themselves.
- Parentage must not create an ancestry cycle.
- All people connected by a relationship must belong to the same workspace.
- Duplicate active relationship records should be prevented where appropriate.
- Ended relationships remain in historical records.
- A person may have multiple parentage relationships and multiple partnerships.
- Deleting or archiving a person must not silently destroy historical context.

Perform critical validation on the server and, where practical, with database constraints/triggers. Never rely only on frontend validation.

## 6. Family tree visualization

The visualization is a primary user experience, but it is generated from database records.

### Required MVP capabilities

- Display person cards and relationship connectors.
- Pan and zoom.
- Select a person and open their profile/details panel.
- Search for a person and focus the canvas on the result.
- Expand and collapse branches.
- Display ancestors and descendants around a selected person.
- Show partnership and parentage connections clearly.
- Handle missing dates, unknown information, and deceased/living status without misleading assumptions.
- Provide a useful empty state and loading/error states.

### Planned visualization modes

1. **Family tree view:** Traditional genealogy-style layout, with generations arranged in a readable hierarchy.
2. **Ancestor view:** Focus on a selected person and show their ancestors.
3. **Descendant view:** Focus on a selected person and show their descendants.
4. **Relationship graph view:** An alternative view for exploring complex connections.

The first release may implement the family tree view plus focused ancestor/descendant navigation. Keep the architecture extensible for the other modes.

### Visualization architecture

Use this pipeline:

```text
PostgreSQL records
       |
       v
Fetch authorized workspace/branch data
       |
       v
Normalize people and relationship entities
       |
       v
Build genealogy graph / view model
       |
       v
Select visualization mode
       |
       v
Calculate layout positions
       |
       v
Render interactive canvas
```

Use React Flow (`@xyflow/react`) for the interactive canvas. Evaluate Dagre or ELK.js for automatic layout. The LLM agent must verify library APIs and compatibility against current documentation before implementation.

Do not treat a generic graph layout as a complete genealogy layout solution. Partnership and parentage connectors may require generated junction nodes or custom edges. These visual-only nodes must not become person records in the database.

Generation numbers should be relative to the selected focus person or view. Avoid storing one permanent generation number on a person because complex relationships can create multiple paths.

## 7. Family history

Plan for these supporting features:

### Events and timeline

Examples:

- Birth
- Baptism
- Marriage
- Death
- Graduation
- Migration/relocation
- Reunion
- Other custom event

Events may involve one or many people. Support uncertain dates and locations.

### Media

- Upload photographs and documents.
- Associate one media item with multiple people.
- Add captions and approximate dates.
- Tag people in group photographs.
- Store media in private storage.
- Authorize every upload and download.

### Sources and evidence

Support sources such as:

- Birth, marriage, and death certificates
- Church or baptismal records
- Interviews and oral histories
- Photographs
- Family documents
- Public historical records

Allow facts to have supporting sources. Consider confidence/status values such as verified, supported, unverified, and disputed. Do not claim that a source proves a fact automatically.

## 8. Collaboration and audit history

### Role permissions (initial proposal)

| Action | Owner | Admin | Contributor | Viewer |
|---|---:|---:|---:|---:|
| View workspace/tree | Yes | Yes | Yes | Yes |
| View permitted profiles | Yes | Yes | Yes | Yes |
| Add people | Yes | Yes | Yes | No |
| Edit people | Yes | Yes | Yes | No |
| Add relationships | Yes | Yes | Yes | No |
| Upload media | Yes | Yes | Yes | No |
| Invite members | Yes | Yes | No | No |
| Change roles | Yes | Limited | No | No |
| Remove members | Yes | Yes | No | No |
| Transfer ownership | Yes | No | No | No |
| Delete workspace | Yes | No | No | No |

The Owner is the ultimate authority. Define exact Admin limitations in code and tests. Contributors should not be able to delete important records permanently in the initial release; prefer archive or a deletion request.

### Audit log

Track important operations:

- Person created/updated/archived
- Relationship created/updated/removed
- Invitation sent/revoked/accepted
- Member role changed or removed
- Media uploaded/deleted
- Workspace settings changed

Record actor, workspace, entity type/id, action, timestamp, and relevant before/after values. Avoid logging passwords, invitation tokens, signed URLs, or unnecessary sensitive data.

### Concurrent editing

Use optimistic concurrency for important records. Add a version number or equivalent updated-at check. If a user edits a stale version, reject the update and show a conflict message rather than silently overwriting another member's changes.

Real-time notifications may be added after core CRUD works. Real-time simultaneous editing is not required for the MVP.

## 9. Privacy and security

Treat all workspaces as private and invitation-only.

Required safeguards:

- Authentication required for private data.
- Workspace membership checked on every read/write operation.
- Role-based authorization on the server.
- PostgreSQL Row-Level Security (RLS) for tenant isolation.
- Private storage buckets.
- Short-lived signed URLs for media.
- File type and size validation.
- Secure, hashed invitation tokens.
- Rate limiting for sensitive endpoints where supported.
- Input validation using schemas.
- Safe error messages that do not leak private records.
- Audit important administrative and data changes.
- Protect living-person information.
- No public family tree links in the initial release.

**Critical:** Do not rely on hiding UI controls. Authorization must be enforced server-side and in database policies. Never expose Supabase service-role credentials to the browser.

---

# Part III — Technical Architecture

## 10. Recommended stack

Use this stack unless repository inspection or a documented technical constraint justifies a change.

| Layer | Recommendation |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript with strict mode |
| UI | React |
| Styling | Tailwind CSS |
| UI components | shadcn/ui, where appropriate |
| Graph canvas | `@xyflow/react` |
| Layout | Dagre or ELK.js, selected after a small proof of concept |
| Database | PostgreSQL via Supabase |
| Authentication | Supabase Auth |
| Database access | Drizzle ORM or Supabase client; choose one primary approach |
| Authorization | Server-side RBAC + PostgreSQL RLS |
| File storage | Private Supabase Storage buckets |
| Email | Resend or another transactional email provider |
| Validation | Zod |
| Testing | Vitest/Jest for unit tests; Playwright for end-to-end tests |
| Deployment | Vercel + Supabase |

### Database access decision

Choose one primary database access strategy after checking the project's needs:

- **Drizzle:** Good TypeScript-first SQL control and explicit migrations.
- **Supabase client:** Convenient integration with Supabase Auth and RLS.
- **Prisma:** Also viable, but avoid mixing multiple ORMs without a clear reason.

Do not use multiple database access layers casually. Document how server-side queries, transactions, and RLS interact. Ensure the selected approach does not bypass intended RLS protections.

## 11. Architecture style

Use a **modular monolith** for the MVP.

Keep domain logic separated into modules, but deploy one application. Do not introduce microservices, queues, or complex infrastructure before they are needed.

Suggested domains:

- Authentication
- Workspace management
- Membership and invitations
- People
- Relationships
- Genealogy calculations
- Tree visualization
- Events and sources
- Media
- Audit history
- Notifications

### Request flow

```text
Browser / Next.js UI
        |
        v
Server Action or Route Handler
        |
        v
Authentication + Workspace Authorization
        |
        v
Input Validation
        |
        v
Domain Service
        |
        v
Database Access / Transaction
        |
        v
PostgreSQL + RLS
        |
        v
Response / UI refresh
```

Use Server Actions for suitable form mutations and Route Handlers for APIs that need stable HTTP contracts, external integrations, or client-side fetching. Keep business rules in reusable services, not inside UI components or route handlers.

## 12. Suggested database entities

The following is a logical model, not final SQL. Refine column types, indexes, constraints, and naming during schema implementation.

### Core entities

#### `profiles`
Application profile associated with an authenticated Supabase user.

- `id` UUID primary key, references `auth.users.id`
- `full_name`
- `avatar_path` nullable
- `created_at`
- `updated_at`

#### `families`
- `id` UUID primary key
- `name`
- `description` nullable
- `cover_image_path` nullable
- `owner_id` references profiles/auth user
- `created_at`
- `updated_at`
- optional `archived_at`

#### `family_members`
- `id` UUID primary key
- `family_id` references families
- `user_id` references profiles
- `role` enum: owner, admin, contributor, viewer
- `joined_at`
- unique (`family_id`, `user_id`)

Ensure ownership is consistent between `families.owner_id` and membership records. Define transactional ownership transfer.

#### `invitations`
- `id` UUID primary key
- `family_id`
- `email`
- `role`
- `token_hash`
- `status`
- `invited_by`
- `expires_at`
- `accepted_at` nullable
- `revoked_at` nullable
- `created_at`

### Genealogy entities

#### `persons`
- `id` UUID primary key
- `family_id`
- `given_name`
- `middle_name` nullable
- `surname` nullable
- `suffix` nullable
- `display_name`
- `gender` nullable/optional
- `biography` nullable
- `birth_date` nullable
- `birth_date_precision`
- `birth_place` nullable
- `death_date` nullable
- `death_date_precision`
- `death_place` nullable
- `life_status` enum: living, deceased, unknown
- `profile_media_id` nullable
- `created_by`
- `updated_by`
- `version` integer
- `created_at`
- `updated_at`
- `archived_at` nullable

Avoid storing unnecessary sensitive data. Consider a separate visibility/privacy policy for sensitive profile fields.

#### `person_names`
- `id`
- `person_id`
- `name`
- `name_type` (maiden, nickname, alias, previous, alternate)
- `created_at`

#### `parent_child_relationships`
- `id`
- `family_id`
- `parent_id` references persons
- `child_id` references persons
- `parentage_type` (biological, adoptive, legal, foster, step)
- `start_date` nullable
- `end_date` nullable
- `notes` nullable
- `created_by`
- `created_at`
- unique/index strategy to prevent accidental duplicate records

#### `partnerships`
- `id`
- `family_id`
- `partnership_type`
- `status`
- `start_date` nullable
- `end_date` nullable
- `location` nullable
- `notes` nullable
- `created_by`
- `created_at`
- `updated_at`

#### `partnership_participants`
- `id`
- `partnership_id`
- `person_id`
- `participant_role` nullable
- unique (`partnership_id`, `person_id`)

#### `guardianships`
- `id`
- `family_id`
- `guardian_id` references persons
- `ward_id` references persons
- `guardianship_type`
- `start_date` nullable
- `end_date` nullable
- `notes` nullable
- `created_by`
- `created_at`

### History and evidence entities

#### `events`
- `id`
- `family_id`
- `title`
- `description` nullable
- `event_type`
- `event_date` nullable
- `date_precision`
- `location` nullable
- `created_by`
- `created_at`

#### `event_participants`
- `id`
- `event_id`
- `person_id`
- `participation_role` nullable

#### `media`
- `id`
- `family_id`
- `storage_path`
- `file_name`
- `mime_type`
- `file_size`
- `caption` nullable
- `uploaded_by`
- `created_at`
- `archived_at` nullable

#### `media_persons`
- `id`
- `media_id`
- `person_id`
- `tag_description` nullable

#### `sources`
- `id`
- `family_id`
- `title`
- `source_type`
- `description` nullable
- `media_id` nullable
- `submitted_by`
- `created_at`

Plan a `person_facts` or equivalent fact/source association so evidence can support a specific claim (such as birth date) rather than only an entire profile.

#### `audit_logs`
- `id`
- `family_id`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `action`
- `old_values` JSONB nullable
- `new_values` JSONB nullable
- `created_at`

### Database integrity requirements

- Use UUID primary keys.
- Add foreign keys and indexes for common lookup paths.
- Index `family_id` on workspace-scoped tables.
- Add uniqueness constraints where appropriate.
- Validate that connected people belong to the same family.
- Prevent self-parentage and self-guardianship.
- Prevent ancestry cycles in transactional application logic, with database-level protection where practical.
- Use transactions for multi-table operations.
- Define archival/deletion behavior carefully.
- Avoid cascading deletion of important historical records without explicit policy.
- Use database migrations committed to version control.

---

# Part IV — API and Domain Operations

## 13. Suggested API surface

The implementation may use Server Actions for some operations, but keep these domain operations available and consistently validated.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/families` | Create workspace |
| GET | `/api/families` | List user's workspaces |
| GET | `/api/families/:familyId` | Get workspace |
| PATCH | `/api/families/:familyId` | Update workspace |
| GET | `/api/families/:familyId/members` | List members |
| POST | `/api/families/:familyId/invitations` | Create invitation |
| POST | `/api/invitations/accept` | Accept invitation |
| DELETE | `/api/invitations/:invitationId` | Revoke invitation |
| POST | `/api/families/:familyId/persons` | Create person |
| GET | `/api/families/:familyId/persons` | List/search people |
| GET | `/api/persons/:personId` | Get person |
| PATCH | `/api/persons/:personId` | Update person |
| POST | `/api/families/:familyId/parentage` | Create parentage |
| POST | `/api/families/:familyId/partnerships` | Create partnership |
| POST | `/api/families/:familyId/guardianships` | Create guardianship |
| GET | `/api/persons/:personId/ancestors` | Get ancestors |
| GET | `/api/persons/:personId/descendants` | Get descendants |
| GET | `/api/families/:familyId/tree` | Get tree view model |
| GET | `/api/families/:familyId/activity` | Get audit/activity history |

All endpoints must verify authentication, workspace membership, role permission, input validity, and workspace ownership of referenced records.

Do not expose internal database errors or private data in error messages.

---

# Part V — User Experience and Pages

## 14. Main application pages

### Public/authentication pages
- Sign in
- Sign up
- Forgot/reset password
- Invitation acceptance

### Authenticated dashboard
- List of family workspaces
- Create workspace
- Pending invitations
- Recent activity

### Workspace pages
- Family tree
- People directory
- Individual profile/details
- Family timeline
- Media/document library
- Members and invitations
- Workspace settings
- Activity history

### Suggested family tree layout

- Top bar: workspace name, search, view selector, invite action.
- Main area: interactive canvas.
- Side panel: selected person's details.
- Context actions: add parent, add child, add partner, add guardian, edit profile.
- Canvas controls: zoom, fit view, center on person, expand/collapse.
- Clear legend for relationship line types.

Keep the interface calm, readable, and usable on desktop first. Ensure basic responsive behavior for tablets and mobile. Do not make complex tree editing unusable on small screens.

## 15. Core user flows

### Create a family tree
1. User registers or signs in.
2. User creates a family workspace.
3. User is assigned the Owner role.
4. User adds the first person or selects a starting individual.
5. User adds relationships and additional people.
6. The tree view updates from saved data.

### Invite a relative
1. Owner/Admin opens Members.
2. Enters email and chooses a role.
3. Server creates a hashed-token invitation with expiration.
4. Email provider sends an invitation link.
5. Invitee signs in or registers.
6. Invitee accepts the invitation.
7. Membership is created transactionally.
8. Invitee can access the workspace according to their role.

### Add a parent and child
1. Contributor selects a person.
2. Chooses “Add parent” or “Add child.”
3. Chooses an existing person or creates a new person.
4. Selects parentage type.
5. Server validates family membership and ancestry cycle rules.
6. Relationship is saved.
7. Tree view is regenerated/refreshed.

### Claim an individual profile
1. An authenticated user requests to link their account to an existing living-person record.
2. The system verifies the request according to a defined policy (for MVP, require Owner/Admin approval).
3. The link is recorded.
4. The account does not automatically gain elevated workspace permissions.

---

# Part VI — MVP Plan

## 16. Release scope

### Release 1: Working collaborative family tree

Must include:

- Authentication
- Private workspace creation
- Multiple workspaces per user
- Invitations and membership roles
- Person CRUD
- Alternative names (basic)
- Parentage relationships
- Partnerships
- Guardianships
- Relationship validation and cycle prevention
- Interactive tree view
- Person details panel
- Search
- Pan/zoom
- Basic ancestor/descendant focus
- RLS and private storage foundation
- Basic audit history for important changes
- Unit and end-to-end tests for critical flows

### Release 2: Family history and stronger collaboration

- Events and timeline
- Photo/document uploads
- Media tagging
- Sources and fact-level evidence
- Activity feed
- Conflict detection for concurrent edits
- Real-time notifications
- Duplicate detection and merge workflow
- More complete ancestor/descendant views

### Release 3: Advanced genealogy

- GEDCOM import/export
- Advanced kinship/relationship finder
- Printable/exportable family tree
- Family statistics
- Historical reports
- AI-assisted extraction from documents, with human review
- Advanced source and uncertainty workflows

Do not start Release 2 or 3 until Release 1 is stable and tested.

## 17. Suggested implementation milestones

| Milestone | Work | Definition of done |
|---|---|---|
| 0. Repository audit | Inspect existing code, scripts, dependencies, and conventions | Written implementation plan; no unnecessary rewrites |
| 1. Foundation | Next.js, TypeScript, styling, Supabase config | App runs locally; environment documented |
| 2. Auth and workspace | Authentication, workspace CRUD, membership | Private workspace access works |
| 3. Invitations and RBAC | Invitation lifecycle and roles | Role tests and invite acceptance pass |
| 4. Person management | Person CRUD, names, profile panel | Authorized users can manage people |
| 5. Relationship engine | Parentage, partnerships, guardianships, validation | Valid relationships save; invalid cycles reject |
| 6. Tree visualization | Graph transformation, layout, React Flow | Tree renders and responds to changes |
| 7. Search and navigation | Search, focus, expand/collapse | Users can find and navigate to people |
| 8. Audit and hardening | Audit logs, RLS review, validation, tests | Critical privacy and regression tests pass |
| 9. MVP deployment | Production configuration and deployment | Deployed app passes smoke tests |

---

# Part VII — Quality Requirements

## 18. Non-functional requirements

### Performance
- Paginate or progressively load large people directories.
- Avoid unnecessary full-tree recalculations.
- Keep database queries scoped by workspace.
- Add indexes based on actual query patterns.
- Cache only where invalidation is understood.

### Reliability
- Use transactions for multi-record operations.
- Handle network and storage failures gracefully.
- Do not silently lose unsaved edits.
- Provide loading, empty, success, and error states.

### Accessibility
- Keyboard-accessible forms and dialogs.
- Visible focus states.
- Accessible labels and validation messages.
- Do not rely on color alone to distinguish relationship types.
- Provide a list-based alternative to the visual tree for users who cannot use the canvas.

### Maintainability
- Strict TypeScript.
- Shared validation schemas.
- Reusable domain services.
- Database migrations under version control.
- Tests for relationship logic and authorization.
- Avoid giant components and unstructured route handlers.

### Privacy
- Private by default.
- Least-privilege roles.
- RLS tests.
- No secrets in client bundles.
- No public media URLs for private family content.

## 19. Testing requirements

At minimum, test:

### Authentication and access
- Unauthenticated user cannot access workspace data.
- Non-member cannot access a workspace.
- Viewer cannot modify data.
- Contributor cannot manage invitations.
- Admin cannot transfer ownership.
- Owner can manage workspace.
- Cross-workspace IDs cannot be used to access or connect records.

### Relationship logic
- Self-parentage rejected.
- Self-guardianship rejected.
- Ancestry cycle rejected.
- Multiple valid parentage records supported.
- Multiple partnerships supported.
- Ended partnerships remain visible historically.
- People from different workspaces cannot be connected.
- Duplicate relationship handling is deterministic.

### Invitations
- Valid invitation accepted.
- Expired invitation rejected.
- Revoked invitation rejected.
- Token cannot be reused.
- Duplicate membership prevented.
- Role assigned correctly.

### Visualization
- Person nodes map to the correct records.
- Parentage and partnership connections are rendered correctly.
- Missing data does not crash layout.
- Search focuses the correct person.
- Expand/collapse does not alter stored genealogy data.

---

# Part VIII — Instructions for the LLM Coding Agent

## 20. Your role

You are the lead full-stack engineer responsible for building this application from the existing repository (or creating a new project if the repository is empty).

Treat this document as the product and architecture source of truth.

Your job is to deliver a working, secure, maintainable application—not merely a mockup, static prototype, or collection of disconnected screens.

## 21. Mandatory working rules

1. **Inspect before changing.** First inspect the repository, package manager, existing architecture, scripts, dependencies, environment configuration, and current implementation.
2. **Plan before coding.** Summarize the existing state, identify gaps, and propose a milestone-based implementation plan.
3. **Preserve working code.** Do not replace or rewrite existing functionality without a clear reason.
4. **Use current documentation.** Verify current Next.js, Supabase, React Flow, ORM, and other library APIs. Do not invent APIs or rely on outdated examples.
5. **Build incrementally.** Implement one milestone or cohesive feature at a time.
6. **Keep types strict.** Avoid `any`, unsafe casts, and duplicated domain types unless justified.
7. **Validate on the server.** Client-side validation is for user experience, not security.
8. **Enforce authorization everywhere.** Check authentication, workspace membership, and role permission on every protected operation. Use RLS as an additional database boundary.
9. **Protect tenant isolation.** Every workspace-scoped operation must verify that all referenced records belong to the same workspace.
10. **Use migrations.** Never make undocumented manual production schema changes.
11. **Test critical behavior.** Add tests for relationships, access control, invitations, and data integrity.
12. **Do not fake functionality.** No buttons that do nothing, placeholder success messages, mock data presented as saved data, or hard-coded relationships in the final product.
13. **Handle errors.** Provide meaningful UI feedback without leaking sensitive details.
14. **Document setup.** Maintain `.env.example`, setup instructions, migration steps, and seed instructions.
15. **Report honestly.** At the end of each milestone, list files changed, behavior implemented, tests run, results, known issues, and next steps.

## 22. Required first response from the coding agent

Before editing files, return:

1. Repository summary.
2. Existing stack and architecture.
3. What already works.
4. Missing requirements compared with this document.
5. Risks or architecture conflicts.
6. Proposed milestone plan.
7. Dependencies or external accounts/configuration required.
8. Questions only when a decision blocks safe implementation.

Do not ask questions already answered in this document. Where a detail is unspecified, make a conservative recommendation, state the assumption, and proceed if it is safe.

## 23. Implementation workflow

For each milestone:

### Step 1 — Plan
- State the goal and scope.
- Identify affected modules, files, and database entities.
- Identify security and migration implications.
- Define acceptance criteria.

### Step 2 — Implement
- Make the smallest coherent set of changes.
- Follow existing project conventions where sensible.
- Keep UI, domain logic, and data access separated.
- Add database migrations and RLS policies when needed.
- Include loading, empty, error, and success states.

### Step 3 — Verify
Run relevant commands, such as:

- Type checking
- Linting
- Unit tests
- Integration tests
- Build
- End-to-end tests for critical user flows

Use the actual scripts defined in `package.json`; do not assume command names.

### Step 4 — Review
Check:

- Authorization and RLS
- Cross-workspace data access
- Input validation
- Database integrity
- Accessibility
- Responsive behavior
- Error handling
- Performance regressions

### Step 5 — Report
Provide:
- Summary of implementation
- Files added/changed
- Database migrations/policies added
- Tests and commands executed
- Test results
- Remaining limitations
- Next recommended milestone

Do not claim a test passed unless it was actually run and passed.

## 24. Architecture-specific instructions

### Genealogy domain
- Keep relationship rules in a dedicated domain/service layer.
- Do not make the React Flow node/edge structure the database schema.
- Store parentage, partnerships, and guardianship separately.
- Derive siblings and calculated kinship relationships where possible.
- Prevent ancestry cycles.
- Use transactions for relationship operations.
- Keep historical relationships when ended.

### Visualization
- Build a transformation layer from database records to graph view models.
- Keep visual junction nodes separate from person records.
- Support missing/uncertain dates and multiple parentage records.
- Test graph transformation independently from React components.
- Prototype the layout algorithm with representative complex family structures before committing to it.

### Security
- Never trust a `familyId`, `personId`, or role supplied by the browser without checking it.
- Never expose service-role keys or private secrets to client code.
- Use private storage for family media.
- Verify workspace membership before creating signed media URLs.
- Ensure RLS policies cover all workspace-scoped tables.
- Review policies for indirect access through joins and RPCs.
- Do not bypass RLS casually. If privileged server operations are necessary, keep them narrowly scoped and validate authorization explicitly.

### Data integrity
- Use database transactions for multi-step writes.
- Validate that people in a relationship belong to the same family.
- Use optimistic concurrency for important editable records.
- Define archive/delete semantics before implementing destructive actions.
- Avoid cascading deletion of genealogical history without explicit user confirmation and policy.

## 25. UI/UX direction

Create a modern, welcoming, clean genealogy application.

Desired characteristics:

- Clear information hierarchy.
- Calm, readable interface suitable for family members of different technical abilities.
- Person cards that show name, photo/placeholder, and available life dates.
- Visually distinct but accessible relationship connectors.
- A practical details side panel.
- Clear add-person and add-relationship actions.
- Responsive dashboard, forms, dialogs, and profile views.
- Helpful empty states that guide the first-time user.
- Consistent spacing, typography, and component patterns.

Do not spend excessive time on decorative effects before core workflows work. The family tree must remain readable with many nodes and different family structures.

## 26. Definition of MVP complete

The MVP is complete only when a user can:

1. Register and sign in.
2. Create a private family workspace.
3. Invite another user.
4. Accept an invitation and join the workspace.
5. See and manage members according to roles.
6. Add and edit individual person records.
7. Create biological, adoptive, legal, foster, and step parentage records.
8. Create and end partnerships.
9. Create guardianship records.
10. See the saved family structure in an interactive tree.
11. Search for a person and focus the visualization.
12. Navigate ancestors and descendants.
13. Be prevented from accessing another workspace's data.
14. Be prevented from creating invalid or cyclic ancestry relationships.
15. See clear feedback when operations succeed or fail.

A polished landing page or attractive static tree alone does not satisfy the MVP.

---

# Part IX — Copy-and-Use Master Prompt

Copy the prompt below into your LLM coding agent after placing this document in the project repository (for example, as `PROJECT_SPEC.md`).

---

## MASTER BUILD PROMPT

You are the lead full-stack engineer building a **private, collaborative family genealogy platform**.

Read the entire `PROJECT_SPEC.md` before making changes. It defines the product vision, requirements, architecture, data model, security rules, milestones, and definition of done. Treat it as the source of truth.

### Primary objective

Build a working web application where invited family members can collaboratively create and maintain one unified family tree per workspace. Users must be able to add individuals, define comprehensive family relationships, and explore those relationships through an interactive visualization.

### Expected stack

Unless the repository or a documented technical constraint requires otherwise, use:

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui
- React Flow (`@xyflow/react`)
- Dagre or ELK.js for layout, selected after a proof of concept
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage with private buckets
- Server-side role authorization and PostgreSQL RLS
- Zod for validation
- Drizzle or one clearly documented database access strategy
- Vitest/Jest and Playwright for testing

Verify current library documentation and compatibility before implementing integrations.

### Non-negotiable domain requirements

- A workspace represents one unified family tree.
- A user can belong to multiple workspaces.
- A person record does not require a user account.
- A living person may optionally be linked to an authenticated account through a controlled claim/approval flow.
- Support biological, adoptive, legal, foster, and step parentage.
- Support multiple partnerships and their historical statuses.
- Support guardianship independently from parentage.
- Derive sibling and other kinship relationships where appropriate.
- Prevent self-parentage, self-guardianship, cross-workspace links, and ancestry cycles.
- Preserve historical relationships and uncertain information.
- Generate visualization data from saved genealogy records; do not store React Flow nodes and edges as the source of truth.
- Keep the application private and invitation-only.

### Security requirements

Every protected operation must validate the authenticated user, workspace membership, role, and ownership of referenced records. Implement and test RLS for all workspace-scoped tables. Do not expose service-role credentials in browser code. Use private media storage and short-lived signed URLs. Store invitation token hashes, not raw tokens.

### Required workflow

**Phase 1 — Inspect and plan**
- Inspect the repository and current code.
- Identify existing stack, scripts, dependencies, conventions, and working features.
- Compare the implementation with `PROJECT_SPEC.md`.
- Report the repository state, gaps, risks, and proposed milestones.
- Do not edit files until this initial audit and plan are presented.

**Phase 2 — Build incrementally**
- Implement one milestone at a time.
- Start with project foundation and database/auth configuration.
- Then implement workspaces, membership, invitations, people, relationship services, visualization, search, and hardening.
- Add migrations, RLS policies, validation, and tests as each feature is introduced.
- Preserve existing working functionality.

**Phase 3 — Verify**
After each milestone, run the relevant type checks, lint, tests, and build using the repository's actual scripts. Add regression tests for changed behavior. Do not claim success without running the checks.

**Phase 4 — Report**
At the end of every milestone, report:
- What was implemented
- Files created or changed
- Database migrations and policies added
- Commands and tests run
- Actual results
- Known issues and remaining work
- Next milestone

### Engineering quality bar

- No fake buttons or non-functional interactions.
- No mock data presented as persisted production data.
- No hard-coded family relationships.
- No business logic embedded in large UI components.
- No unsafe authorization assumptions.
- No unexplained `any` types.
- No destructive schema changes without migrations and review.
- No premature microservices.
- Provide usable loading, empty, error, and success states.
- Keep the interface accessible and responsive.
- Prioritize correctness, privacy, and data integrity over visual polish.

### First task

Do not start by generating the entire application at once.

First, inspect the repository and return the required repository audit and milestone plan described in `PROJECT_SPEC.md`. Wait for approval if a proposed change is destructive, changes the agreed architecture, requires paid services, or introduces a significant product decision. For routine implementation details, state reasonable assumptions and proceed.

Your final goal is a tested, secure, maintainable MVP that satisfies the definition of done in `PROJECT_SPEC.md`.

---

# Part X — How to Use This Document

## 27. Recommended workflow with an LLM coding tool

1. Put this file in the root of the project repository and name it `PROJECT_SPEC.md`.
2. Open the repository in your coding agent (for example, OpenCode, Claude Code, Cursor, or another coding assistant).
3. Paste the **Master Build Prompt** from Part IX.
4. Let the agent inspect the repository and produce its audit and plan.
5. Review the plan before allowing major implementation work.
6. Ask it to implement only the first milestone.
7. Review the code and run the application locally.
8. Ask the agent to run tests and fix issues before moving to the next milestone.
9. Keep `PROJECT_SPEC.md` updated when you intentionally change product decisions.
10. Commit working milestones to Git so you can roll back safely.

## 28. Useful follow-up prompts

### Start the next milestone

> Read `PROJECT_SPEC.md` and inspect the current repository state. Identify the next incomplete milestone. Summarize its scope, affected files, database changes, security considerations, and acceptance criteria. Then implement only that milestone. Run the relevant checks and report actual results.

### Review relationship logic

> Audit the genealogy relationship model and implementation against `PROJECT_SPEC.md`. Test biological, adoptive, legal, foster, and step parentage; multiple partnerships; guardianship; sibling derivation; cross-workspace validation; self-relationships; and ancestry-cycle prevention. Identify correctness gaps, implement fixes, and add regression tests.

### Review security

> Perform a security review of authentication, workspace membership, role authorization, RLS policies, invitation acceptance, and private media access. Attempt to identify cross-workspace data access and privilege escalation paths. Fix issues and add tests. Do not claim the system is secure based only on frontend checks.

### Review the tree visualization

> Review the family tree transformation and layout logic against `PROJECT_SPEC.md`. Test multiple generations, multiple parentage records, remarriages, step/adoptive relationships, guardianships, missing dates, and large branches. Ensure visual-only junction nodes are not persisted as people. Improve readability without changing the underlying genealogy data.

### Prepare for deployment

> Review the application for deployment readiness. Verify environment variables, database migrations, RLS policies, storage policies, authentication redirect URLs, email configuration, build output, error handling, and production secrets. Create or update deployment documentation and `.env.example`. Do not expose secrets or claim deployment success unless verified.

---

## Final instruction to the coding agent

**Build the genealogy system first, then build the visualization on top of it.** The accuracy of people, relationships, permissions, and historical records is more important than making the first screen look impressive. Deliver the project in small, tested, reviewable milestones.
