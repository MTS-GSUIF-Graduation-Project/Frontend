# GSUIF Frontend Implementation Plan

Status: implementation-ready for SCRUM-68 through SCRUM-71. SCRUM-80 scope is in section AE, which supersedes the generation restrictions below for that ticket only.  
This document is the source of truth for the implementation agent.  
It does not authorize new backend endpoints, GitHub pushes, or Jira changes.

Backend baseline verified for this plan:

- Repository: `MTS-GSUIF-Graduation-Project/gsuif-backend`
- Branch: `develop`
- Commit: `99c90935279fd44dac6ab0969139a7d4b65384f8`
- Commit message: merge of pull request #27, SCRUM-27 metadata JSON schema validator
- Date: 2026-09-27

If the backend `develop` moves past that commit, stop and re-read the controllers, DTOs, and `SecurityConfig` before coding.

Naming note: in this plan, `develop` in any statement about the API, endpoints, DTOs, or the baseline commit always means the backend repository's `develop` branch. The frontend repository has its own `develop` base branch by project decision (section Z). The two are different branches in different repositories.

---

## A. Executive Summary

GSUIF is a metadata-driven platform. The backend stores projects, pages, and immutable metadata versions, and it can issue a JWT. The frontend in this plan is the Phase 2 Angular application that lets a signed-in developer sign in, land on a home page, and browse that metadata. It does not generate code.

Current scope is SCRUM-68, SCRUM-69, SCRUM-70, and SCRUM-71, in that order. The backend reads required by SCRUM-71, and the login endpoint required by SCRUM-69, already exist on the verified `develop` commit. Generation, build validation, artifact download, and export do not exist as HTTP APIs on that commit. They stay out of this implementation.

Major decisions already confirmed by the human, and checked against `develop`:

- A 401 from `POST /api/auth/login` stays on `/login` and shows the backend message.
- A 401 from any other API clears `sessionStorage` and redirects to `/login`.
- The JWT is stored in `sessionStorage` under the single key `gsuif.auth`. `AuthService` is the only reader and writer.
- Routes are `/login`, `/home`, `/projects`, `/projects/:projectId`, and `/projects/:projectId/pages/:pageId/versions`.
- Successful login always navigates to `/home`. There is no `returnUrl` in this scope.
- Local login uses a user created on the backend machine. Credentials are not committed.
- The Angular dev server proxies `/api` to `http://localhost:8080`. Backend CORS is not added.

No project file specifies a color system, font, component library, or motion system. Section Q defines one implementation visual language so the four tickets cannot diverge. That language is a plan convention, not a discovered brand standard.

Jira requires Angular 17 or newer and does not pin a release. Before scaffolding, follow the version procedure in section M, record the exact Angular version and the Node.js version, and do not change that Angular version later. Do not leave the implementation report as `17+`.

Known limit, not a contract break: the backend `local` profile sets `gsuif.security.mode` to `dev`, and `dev` permits every request. A non-login 401 will not occur until the backend runs with security mode other than `dev`.

---

## B. Discovery Sources

No discovery markdown files exist in `G:\CSAI-801\graduation project\gsuif-Frontend` or the parent graduation-project folder. Findings below come from these sources.

| Source | Type | What it contributed | Authority |
|---|---|---|---|
| `gsuif-backend` `develop` @ `99c9093` | Backend code | Endpoints, DTOs, errors, security, pagination, schema files | Primary for API behavior |
| Files read on that commit: `AuthController.java`, `LoginRequest.java`, `AuthResponse.java`, `AuthServiceImpl.java`, `UserDetailsServiceImpl.java`, `JwtUtil.java`, `JwtAuthenticationFilter.java`, `JwtAuthenticationEntryPoint.java`, `JwtAccessDeniedHandler.java`, `SecurityConfig.java`, `GlobalExceptionHandler.java`, `ApiResponse.java`, `PagedBody.java`, `GsuifProjectController.java`, `GsuifPageController.java`, `MetadataVersionController.java`, `GsuifProjectServiceImpl.java`, `GsuifPageServiceImpl.java`, `MetadataVersionServiceImpl.java`, `ProjectDto.java`, `PageDto.java`, `MetadataVersionDto.java`, `CreateProjectRequest.java`, `UpdateProjectRequest.java`, `CreatePageRequest.java`, `UpdatePageRequest.java`, `CreateMetadataVersionRequest.java`, `MetadataSchemaValidator.java`, `OpenApiConfig.java`, `application.yml`, `application-local.yml`, `application-test.yml`, `docker-compose.yml`, `sql/V1__init_schema.sql`, `pom.xml`, `standards-checklist.md`, `DECISIONS.md` | Backend code and project standards | Contracts cited in sections E–K | Primary, except standards are secondary to code when they differ |
| Jira project SCRUM on `https://queensu-team-kk3a58jk.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog`, read in an authenticated browser session on 2026-10-02 | Jira | Ticket text, status, and issue links for SCRUM-22, 25, 28, 44, 46–49, 60, 64–72 | Authoritative for task scope and dependencies. Not authoritative over implemented HTTP behavior |
| Human decisions in the 2026-10-02 contract message | Approved frontend decisions | 401 split, `sessionStorage`, routes, local user, dev proxy | Authoritative for those frontend choices |
| C4 diagrams under `G:\CSAI-801\graduation project\architecture` (`architecture-1-v7`, `architecture-2-v7`, `architecture-3-v7`) | Architecture diagrams | Frontend is a planned Angular app: authentication, dashboard, metadata browser. Generation and external AI are planned, not current | Supporting. Do not add endpoints from the diagrams |
| Local `*.local.md` handoff | Expected local handoff | NOT FOUND on disk | Not available |
| Frontend GitHub repository `MTS-GSUIF-Graduation-Project/gsuif-Frontend` | Empty repository | No commits, no application source, default branch `main` | Confirms greenfield frontend |
| This conversation's earlier discovery passes | Analysis | Consolidated here. Not a separate file | Supporting. Re-checked against the commit above before this plan |

---

## C. Discovery Consolidation

### Architecture

- Backend: Spring Boot 4.0.8, Java 21, package `eg.mts.gsuif`.
- Database: PostgreSQL 16 in `docker-compose.yml`, database name `gsuif_db`, port 5432. H2 in PostgreSQL compatibility mode for tests. Supabase is not part of the architecture.
- Server port: 8080 (`application.yml`).
- Default Spring profile: `local`.
- Frontend stack required by Jira: Angular 17 or newer. No release is pinned in Jira or in this plan. The exact version is an implementation fact chosen by the procedure in section M, then recorded. Do not select a version only because it is the newest available. Do not silently switch versions later.
- STD-07 folders are mandatory. Jira also requires `app-routing.module.ts`. A newer Angular CLI standalone default does not replace that file.
- Phase 1 generation is template-based (ADR-003, FreeMarker). It is not an HTTP API on this commit.

### Backend

- Implemented and relevant: login, projects, pages, metadata versions, unified errors, JWT filter, Swagger.
- In progress in Jira, not treated as available: SCRUM-46 current-version routes, SCRUM-44 templates.
- To do in Jira and absent on this commit: generation provider, generation REST, build-validation API, artifact registry API, export API, external AI, WOMS demo metadata.

### Authentication

- `POST /api/auth/login`.
- Header: `Authorization: Bearer <token>`.
- No refresh endpoint. No logout endpoint. No registration endpoint.
- `gsuif.security.mode=dev` permits all requests. `test` and `prod` require a JWT except `/api/auth/**` and Swagger paths.
- Login `roles` are authority strings that already start with `ROLE_`. Names that do not start with `ROLE_` are omitted. No role catalog is seeded.

### API

- Success and error bodies use five fields: `status`, `clientMessage`, `statusCode`, `body`, `errors`.
- `ApiClientService` returns `ApiResponse<T>` and does not unwrap it. Feature services check the envelope, unwrap `body`, and return domain models. Components never receive `ApiResponse<T>` (STD-32, required by SCRUM-71).
- Work orders exist at `/api/v1/work-orders`. They are a reference API and are outside SCRUM-68–71.

### Data models

- `ProjectDto`: `id`, `name`, `description`, `createdAt`, `updatedAt`, `createdBy`, `lastModifiedBy`.
- `PageDto`: `id`, `projectId`, `name`, `route`, plus the same audit fields. No current-version id.
- `MetadataVersionDto`: `id`, `pageId`, `projectId`, `version`, `schemaVersion`, `isCurrent`, `snapshot`, plus audit fields.
- The database column `gsuif_page.current_metadata_version_id` is not in `PageDto`.

### Routing

- Confirmed frontend routes are listed in section H.
- Backend page `route` is stored metadata for a generated UI page. It is not an Angular route in this application.

### Pagination

- `body` contains `data`, `totalPages`, `totalElements`, `size`, `number`.
- `number` comes from Spring `Page.getNumber()` and is zero-based.
- Query names: `page`, `size`, `sort`.
- Projects and pages: default size 20, sort `createdAt,desc`.
- Metadata versions: default size 20, sort `version,desc`.
- Services cap `size` at 100 and floor it at 1.
- Unknown sort property: HTTP 400, `clientMessage` `"Invalid property reference in sorting"`.
- No search parameter on projects, pages, or metadata.

### Frontend standards

- STD-07: `core/guards`, `core/interceptors`, `core/services`, `core/models`, `shared`, `features/<feature>`. Deferred for Phase 1 sign-off. Jira says SCRUM-68 activates it.
- STD-29: `AuthInterceptor` attaches the JWT on every outgoing request.
- STD-30: `ErrorInterceptor` reports errors through `NotificationService` and, on 401, logs out and redirects. The approved decision narrows that 401 rule so the login request itself does not redirect.
- STD-31: global spinner from pending request count. Owner is SCRUM-72, not SCRUM-68–71.
- STD-32: unwrap `ApiResponse<T>` in feature services. `ApiClientService` does not unwrap. There is one unwrapping path, described in section I.

### Security

- Do not commit `.env`, handoff files, JWTs, or passwords.
- `application-local.yml` and `application-test.yml` on the public backend contain a JWT secret. Do not copy it into the frontend.
- Do not log tokens. Backend logging already masks secrets; the frontend must not undo that.

### UI, UX, design, animation

- Jira requires a login form, a welcome message, quick links, and list/detail/history screens.
- UI library, CSS framework, brand colors, typeface, and motion durations: NOT FOUND.
- Section Q and section S are the single visual and motion language for this implementation. They are plan conventions.
- Do not invent dashboard statistics, charts, or sample projects.

### Testing and browser verification

- `ng serve` must run for SCRUM-68.
- Later tickets need the backend on port 8080 and a locally created user.
- Playwright runs against the real backend through the dev proxy. Do not mock `/api` to hide a broken contract.
- Non-login 401 cannot be shown while backend security mode is `dev`.

### Git

- Frontend local repository has no commits and no remote configured in the workspace.
- GitHub repository exists and was empty when inspected. Its default branch is `main`. No frontend `develop` branch was established by frontend evidence.
- The human performs every Git and GitHub write. Agents only inspect (section Z).

Backend Git evidence (observed in `gsuif-backend`, not frontend facts):

- Feature branches are named `feature/SCRUM-XX-description`.
- Feature branches are merged by pull request into the backend `develop`; `develop` goes to `main` by pull request.
- The backend README states that direct pushes to `main` and `develop` are not allowed.
- Backend commit messages use `[SCRUM-XX] Short description`.
- Merge commits ("Merge pull request #N from …") are observable in the backend history.
- A pull request title convention and a squash or rebase convention were not established by available project evidence.

Frontend Git decisions (human-approved project decisions, not previously established frontend evidence): see section Z.

### Blockers and future work

- See section AB. Nothing in that table blocks SCRUM-68.
- SCRUM-69 can be built against the login contract. Proving a non-login 401 requires a non-`dev` backend mode.
- SCRUM-72 and generation remain blocked.

---

## D. Jira Requirements

### SCRUM-68 — Angular skeleton

1. Jira says: Angular 17+. Folders `core/guards`, `core/interceptors`, `core/services`, `core/models`, `shared`, and `features/<feature>`. File `app-routing.module.ts`. `ng serve` runs with no errors. Folder structure matches STD-07 exactly.
2. Status: To Do.
3. Dependencies: none.
4. Blocks: SCRUM-69.
5. Blocked by: nothing.
6. Backend support: not an API task.
7. Can be implemented now: yes.
8. Missing: a pinned Angular release. Jira says 17 or newer only. Select the exact version with the section M procedure and record it. Do not leave it as `17+`.
9. Owner of a pinned release: No Jira ticket found.
10. No Jira ticket found for the exact version, a UI library, or CORS.

### SCRUM-69 — Login page

1. Jira says: AuthService with `login`, `logout`, token storage, `isLoggedIn()`, `getUserRoles()`, `hasRole()`. AuthGuard. AuthInterceptor. ErrorInterceptor that logs out and redirects on 401. Reactive LoginComponent. Valid login stores the token and navigates home. Invalid login shows a notification and does not navigate. A 401 from any API call logs out and redirects.
2. Status: To Do.
3. Dependencies: blocked by SCRUM-68.
4. Blocks: SCRUM-70.
5. Blocked by: SCRUM-68.
6. Backend support: yes for `POST /api/auth/login` and `Authorization: Bearer`.
7. Can be implemented now: yes, after SCRUM-68, using the approved 401 split below. Jira’s two 401 sentences conflict with each other. The approved decision resolves the frontend behavior. The backend still returns 401 for bad credentials.
8. Missing: storage mechanism was unspecified in Jira and is now decided (`sessionStorage`). Local user provisioning has no ticket. Non-login 401 is not observable in `dev` security mode.
9. Local user: No Jira ticket found. CORS fix is written inside SCRUM-72, not a separate ticket. This plan uses the approved dev proxy instead of waiting for SCRUM-72 and instead of adding backend CORS.

### SCRUM-70 — Home dashboard

1. Jira says: `HomeComponent` at `/home`, protected by AuthGuard. Welcome message and quick links to the metadata browser. `/home` is unreachable without a session. Links navigate correctly.
2. Status: To Do.
3. Dependencies: blocked by SCRUM-69.
4. Blocks: SCRUM-71.
5. Blocked by: SCRUM-69.
6. Backend support: no home API. Welcome can use `username` from the login response. Links use the approved routes.
7. Can be implemented now: yes, after SCRUM-69.
8. Missing welcome copy: NOT FOUND in Jira. Use the rule in section O. Do not invent metrics.
9. No Jira ticket found for welcome copy or a dashboard API.

### SCRUM-71 — Metadata browser

1. Jira says: project list/detail, page list/detail inside a project, version history using `GET /api/v1/pages/{pageId}/metadata`. Services unwrap `ApiResponse<T>`. Components never see the raw envelope. Lists and details show real backend data.
2. Status: To Do.
3. Dependencies: blocked by SCRUM-70.
4. Blocks: SCRUM-72.
5. Blocked by: SCRUM-70.
6. Backend support: yes for the GET endpoints in section E. Create, update, and delete also exist and are not in this ticket.
7. Can be implemented now: yes, after SCRUM-70, as a read-only UI.
8. Missing: none for the named read APIs. `GET/PUT .../metadata/current` is not on `develop`.
9. Current-pointer routes belong to SCRUM-46, which is In Progress. Do not call them.

### SCRUM-72 — Full Angular ↔ backend integration

1. Jira says: LoadingInterceptor with a global spinner from the pending request count. Manual path: login, browse metadata, trigger generation, see result. Fix CORS or config gaps. No mocked data in components. Spinner works across concurrent requests.
2. Status: To Do.
3. Dependencies: blocked by SCRUM-71 and SCRUM-66.
4. Blocks: SCRUM-67.
5. Blocked by: SCRUM-71 and SCRUM-66.
6. Backend support: partial. Login and metadata browse exist. Generation HTTP does not.
7. Can be implemented now: no.
8. Missing: generation endpoint, result body, and a non-`dev` way to observe protected 401s if that mode is still required. CORS is this ticket’s own scope. This plan already chooses a dev proxy for SCRUM-69–71 and does not add backend CORS.
9. Generation HTTP owner: SCRUM-48. SCRUM-72 does not link to SCRUM-48. SCRUM-48 is still the only Jira text that names generation URLs.

### SCRUM-66 — AI generation end-to-end demo

1. Jira says: demonstrate metadata to AI-generated code to build validation to export, using WOMS metadata from SCRUM-60. Document the run as README commands. A second team member can reproduce it. Generated code passes build validation.
2. Status: To Do.
3. Dependencies: blocked by SCRUM-65 and SCRUM-60.
4. Blocks: SCRUM-72 and SCRUM-67.
5. Blocked by: SCRUM-65 and SCRUM-60.
6. Backend support: no HTTP API for this flow on the verified commit.
7. Can be implemented now: no. It is not an Angular screen in the current scope.
8. Missing: AI provider, WOMS dataset, generation API, build-validation API, export API.
9. Owners: SCRUM-65, SCRUM-60, SCRUM-48, SCRUM-47, SCRUM-49, SCRUM-64. SCRUM-66 itself does not define request or response JSON.

---

## E. Backend Contract

Base URL in local development: the browser calls `/api/...` on the Angular dev server. The proxy forwards that prefix to `http://localhost:8080`. Do not hard-code the host in components.

Authentication below is the `test`/`prod` rule. In `dev`, every path is permitted even though login still works when called.

Envelope for every body below:

| Field | Type | Success | Error |
|---|---|---|---|
| `status` | string | `"OK"` | `HttpStatus.name()`, such as `BAD_REQUEST` or `UNAUTHORIZED` |
| `clientMessage` | string | human-readable success text | human-readable error text |
| `statusCode` | number | 200 or 201 | same as the HTTP status |
| `body` | object, array wrapper, or null | payload | null |
| `errors` | map of string to string, or null | null | field or path map, or null |

### POST `/api/auth/login`

- Auth: public.
- Body: `{ "username": string, "password": string }`. Both required, non-blank.
- 200: `body` is `token` (string), `tokenType` (`"Bearer"`), `username` (string), `roles` (string array). `clientMessage` is `"Authentication successful"`.
- 400: blank fields. `clientMessage` `"Validation failed"`. `errors.username` and/or `errors.password`.
- 401: bad credentials. `clientMessage` `"Invalid username or password"`. `errors` null.
- No query parameters.

### GET `/api/v1/projects`

- Auth: required outside `dev`.
- Query: `page` (zero-based), `size` (default 20, max 100), `sort` (default `createdAt,desc`).
- 200: `body` is a page of `ProjectDto`.
- 400: invalid sort property.

### GET `/api/v1/projects/{id}`

- Path `id`: UUID.
- 200: one `ProjectDto`.
- 404: `clientMessage` `"Project not found with id: {id}"`. `errors` null.
- 400: `id` is not a UUID. `errors` contains the parameter name and `"Invalid value"`.

### GET `/api/v1/projects/{projectId}/pages`

- Path `projectId`: UUID.
- Query: same paging names. Default sort `createdAt,desc`. Default size 20. Max 100.
- 200: page of `PageDto`.
- 404: unknown project.

### GET `/api/v1/projects/{projectId}/pages/{pageId}`

- 200: one `PageDto`.
- 404: unknown project or page. Message includes both ids when the page is missing in that project.

### GET `/api/v1/pages/{pageId}/metadata`

- This is the only metadata URL named by SCRUM-71.
- Query: `page`, `size`, `sort`. Default sort `version,desc`. Default size 20. Max 100.
- 200: page of `MetadataVersionDto`. Each element includes `snapshot`.
- 404: unknown page.

### GET `/api/v1/pages/{pageId}/metadata/latest`

- Exists on `develop`. Not required by the SCRUM-71 wording.
- 200: one `MetadataVersionDto` for the highest `version` number.
- 404: page missing, or the page has no versions.
- Do not treat this record as “current”. `isCurrent` is a separate boolean.

### GET `/api/v1/pages/{pageId}/metadata/{versionId}`

- Exists on `develop`. SCRUM-71 does not name it.
- The list response already includes `snapshot`, so the version screen does not need this call.
- 404: page or version missing.

### Not on `develop`

- `GET` or `PUT /api/v1/pages/{pageId}/metadata/current`
- `POST /api/v1/generation/generate`
- `GET /api/v1/generation/providers`
- `GET /api/v1/generation/runs/{id}`
- Any export or download URL
- Logout, refresh, registration

SCRUM-48 describes the three generation paths and a body `{pageId, generationType}`. That ticket is To Do. Do not call those paths.

### Write endpoints that exist and must not be used by SCRUM-71

The current UI is read-only. These are documented so they are not invented later and are not called now.

- `POST /api/v1/projects` → 201. Body `name` (required, max 200) and optional `description`.
- `PUT /api/v1/projects/{id}` → 200. Same fields. Null description clears it.
- `DELETE /api/v1/projects/{id}` → 200, `body` null. 400 if the project still has pages.
- `POST /api/v1/projects/{projectId}/pages` → 201. Body `name` (required, max 200) and optional `route` (max 255). Blank route is stored as null.
- `PUT /api/v1/projects/{projectId}/pages/{pageId}` → 200. Blank route clears it.
- `DELETE /api/v1/projects/{projectId}/pages/{pageId}` → 200. 400 if any metadata version exists.
- `POST /api/v1/pages/{pageId}/metadata` → 201. Body only `schemaVersion` (must be `1.0.0`) and `snapshot`. Extra JSON properties are rejected.

Duplicate names return 400 with `errors.name` or `errors.route`.

### Other errors

| HTTP | When | `clientMessage` | `errors` |
|---|---|---|---|
| 400 | malformed JSON | `"Malformed request body"` | null |
| 403 | authenticated but denied | `"Access denied"` | null |
| 405 | method not allowed | `"HTTP method not supported"` | null |
| 415 | unsupported media type | `"Unsupported media type"` | null |
| 500 | unexpected | `"An unexpected error occurred"` | null |

No frontend role restriction is declared on the project, page, or metadata controllers. Do not invent `ADMIN` or `USER`.

---

## F. Authentication Contract

### Login

`AuthService.login` POSTs `{ username, password }` to `/api/auth/login`.

On HTTP 200 and `status === "OK"` and `errors == null`:

- Read `body.token`, `body.tokenType`, `body.username`, `body.roles`.
- Write them to `sessionStorage` under one key, `gsuif.auth`.
- Do not log the token.
- Navigate to `/home`.

Successful login always navigates to `/home`. `AuthGuard` does not capture or restore a `returnUrl`. If a signed-out user opens a protected route, the guard sends them to `/login`, and a later successful login still goes to `/home`. Do not implement `returnUrl` unless a later approved requirement adds it.

On HTTP 401 for this URL only:

- Do not clear the authentication session.
- Do not redirect to `/login`.
- Remain on `/login`.
- Keep the authentication state empty.
- `LoginComponent` shows `clientMessage` in the shared notification. If the body cannot be read, show a fixed fallback: “Sign-in failed.”
- Keep the typed username. Clear the password field.
- `ErrorInterceptor` does not run the protected-resource logout or redirect for this request, and it does not show a second notification.
- `AuthService.login` does not navigate and does not call `NotificationService`. It surfaces the error to `LoginComponent`, which notifies once.

On HTTP 400 for this URL:

- Stay on `/login`.
- Show field messages from `errors` on the matching controls.
- Also show `clientMessage` in the notification.

### Storage

Authentication storage:

```text
Storage: sessionStorage
Storage key: gsuif.auth
```

The value is JSON with the approved session fields: `token`, `tokenType`, `username`, `roles`.  
`tokenType` from the backend is `"Bearer"`. If it is missing, the header rule below still uses `Bearer`.  
`AuthService` is the single owner of reading, writing, and removing this key.

`AuthInterceptor`, `AuthGuard`, and UI components call `AuthService`. They do not read or write `sessionStorage` themselves, and they do not create other keys such as `token`, `jwt`, `authToken`, `user`, or `roles`.

Do not store authentication state in `localStorage`. Do not persist the username or password.

Clear `gsuif.auth` on logout and on a non-login 401. Login 401 does not clear it, because a failed login never writes it.

There is no backend logout endpoint. `logout()` only clears `gsuif.auth` and navigates to `/login`.

There is no refresh endpoint. Do not add a refresh timer or a silent re-login.

### Guards and interceptors

`AuthGuard`: allow the route only when `AuthService.isLoggedIn()` is true, which means the stored token is a non-empty string. Otherwise redirect to `/login` and cancel the current navigation. Do not add a `returnUrl` query parameter. This is the meaning of “valid session” for SCRUM-70, because the backend has no session and no “who am I” endpoint.

`AuthInterceptor`: for authenticated API requests, set:

```text
Authorization: Bearer <stored JWT>
```

The JWT is `AuthService.getToken()`. Do not invent another authorization scheme. Do not send the username or password on normal API requests. Do not log the JWT. If a token exists, set that header on every outgoing request, including login. If no token exists, do not set the header and do not invent a token. This matches STD-29 without sending an empty header.

`ErrorInterceptor`:

```text
Login 401:
ErrorInterceptor must not perform the protected-resource logout/redirect behavior.
It must not show a notification for POST /api/auth/login 401.
LoginComponent is the only UI handler for that response.

Non-login 401:
ErrorInterceptor performs the global authentication recovery behavior.
It calls AuthService.clearSession once, navigates to /login once, and shows clientMessage when present.
Feature components must not also redirect.
```

- Any other HTTP error: show `clientMessage` when present. Do not redirect, except the non-login 401 rule above.

Do not register a second global handler that redirects every 401, including login. Do not change the backend to create this split.

### Roles

`getUserRoles()` returns the stored `roles` array, or an empty array.  
`hasRole(role)` returns true only when that array contains the exact string.  
`isLoggedIn()` is the same check as the guard: a non-empty stored token.  
Do not strip or add `ROLE_`. The backend already returns the prefixed form, and only that form.

### Local testing

A person creates a user in the local backend database. The frontend never contains the username or password. The implementation agent does not commit a fixture, a seed file, or a default password.

While the backend runs with `gsuif.security.mode=dev`, protected GETs succeed without a token. The guard still blocks `/home` and the metadata routes in the Angular app. The non-login 401 Playwright case is blocked until the backend is started with mode `test` or `prod`. Do not change the backend’s security mode from the frontend repository.

---

## G. Frontend Architecture

Jira requires NgModule files, including `app-routing.module.ts` and feature modules. Do not replace that with a standalone-only tree that omits those files. Whether individual components are internally standalone is UNRESOLVED. Declare them in the feature modules so the required module structure is real.

```text
The frontend architecture must preserve the required app-routing.module.ts structure.

Do not replace the required routing structure with a standalone-only routing architecture.

If the selected Angular version introduces newer standalone defaults, adapt the generated project only as necessary while preserving app-routing.module.ts and the Jira-required routing structure.
```

Do not replace this requirement with a generic “latest Angular” routing style.

Angular CLI will place application code under `src/app/`. STD-07 does not name `src/`. Map the required folders to:

```text
src/app/app-routing.module.ts
src/app/app.module.ts
src/app/core/guards/
src/app/core/interceptors/
src/app/core/services/
src/app/core/models/
src/app/shared/
src/app/features/<feature>/
```

Feature folders for this scope:

```text
src/app/features/auth/
src/app/features/home/
src/app/features/metadata/
```

`auth` is created in SCRUM-69. `home` is created in SCRUM-70. `metadata` is created in SCRUM-71. SCRUM-68 creates the empty feature pattern with a `.gitkeep` or an empty `features` folder plus the routing module. Do not build login or metadata screens in SCRUM-68.

Shared UI primitives from section T are created in SCRUM-68 and live under `src/app/shared/`. Feature screens consume them. Feature screens do not restyle them with a second palette.

Configuration:

- `proxy.conf.json` at the project root, used by `ng serve`.
- Proxy only `/api` to `http://localhost:8080`, with `changeOrigin` true.
- HTTP calls use relative URLs starting with `/api`.
- No production API host is documented. Do not invent one. Do not add `environment.prod.ts` secrets.

`CoreModule` provides the interceptors and singleton services. `SharedModule` exports the visual primitives and declares them. Feature modules import `SharedModule` and declare their own screens. `AppRoutingModule` holds the routes in section H. Lazy-loading is not required by Jira. Use eager feature modules unless a later review shows a measured need. Do not add NgRx. None is specified.

Do not introduce a new npm dependency unless it is explicitly required by this plan and recorded in the task report. Before adding one, state why it is necessary, confirm it does not duplicate Angular or browser functionality, and confirm it does not introduce a second design system.

Do not introduce:

- Angular Material
- PrimeNG
- Bootstrap
- Tailwind
- another UI component framework
- another CSS or design system
- another icon system
- a downloaded web font

unless the human explicitly approves that addition. The tokens in section Q and the components in section T are the only visual system.

App shell: `AppComponent` contains the shared skip link, the shared top bar, and `router-outlet`. The top bar shows the product name “GSUIF” and, when `isLoggedIn()` is true, the username plus a logout control. Login route hides the logout control.

---

## H. Route Architecture

| Route | Purpose | Access | Component | Data | Entered from | Loading | Error | Empty |
|---|---|---|---|---|---|---|---|---|
| `/login` | Sign in | Public. If already signed in, redirect to `/home` | `LoginComponent` | None until submit | Guard redirect, logout, bookmark | Submit button shows its busy label and is disabled | 400 on fields; 401 in notification; no navigation | Not applicable |
| `/home` | Landing | `AuthGuard` | `HomeComponent` | Username from `AuthService.getUsername()` | Successful login, logo | No API call, so no data spinner | Guard redirect only | Not applicable |
| `/projects` | Project list | `AuthGuard` | `ProjectListComponent` | `GET /api/v1/projects` | Home quick link, top bar | Shared loading state in the table region | Shared error state with `clientMessage` and retry | Shared empty state when `totalElements` is 0 |
| `/projects/:projectId` | One project and its pages | `AuthGuard` | `ProjectDetailComponent` | `GET /api/v1/projects/{id}` and `GET /api/v1/projects/{projectId}/pages` | A project row | Each region loads on its own | 404 shows the backend message and a link back to `/projects` | Project exists but page list is empty: empty state for pages only |
| `/projects/:projectId/pages/:pageId/versions` | Page identity plus version history | `AuthGuard` | `VersionHistoryComponent` | `GET` page by id, then `GET /api/v1/pages/{pageId}/metadata` | A page row | Same pattern | 404 for the page or the metadata list uses the backend message | No versions: empty state, no snapshot pane |
| Unknown path | Not specified by Jira | Public redirect | none | none | Bad URL | none | Redirect to `/login` if signed out, otherwise `/home` | Not applicable |

Do not add `/projects/:projectId/pages/:pageId` as a separate page. Page fields are the header of the versions screen. That is the page detail for this scope.

Project detail loads `GET /api/v1/projects/{projectId}` and `GET /api/v1/projects/{projectId}/pages` independently.

```text
The project details region and the pages region must have independent loading and error states.

If the project request succeeds and the pages request fails:
- keep the loaded project information visible
- show the pages-region error state
- do not replace the whole screen with a generic project error

If the project request fails:
- show the project-level error state
- do not pretend that project data exists

Do not fabricate pages or projects when a request fails.
```

On the version screen, after a successful version-list response, if `data` has at least one row, select the first returned row and show its `snapshot`. Under the approved default sort `version,desc`, that first row is the highest version number on that page of results. That selection is not a “Latest” label. If the list is empty, select nothing, show the empty state, and do not fabricate a snapshot. Choosing another row replaces the snapshot. Do not call `/metadata/current`.

Top bar links when signed in: Home (`/home`), Projects (`/projects`). Do not add a Generation link.

---

## I. API Service Design

All HTTP goes through one client. Envelope handling has one owner.

```text
ApiClientService is responsible only for HTTP communication.

ApiClientService MUST NOT silently unwrap ApiResponse<T>.

Feature/domain services are responsible for:
- calling ApiClientService
- receiving ApiResponse<T>
- checking the response/error state
- unwrapping response.body
- exposing domain models to components

Components must never receive or process raw ApiResponse<T>.
```

```text
Component
   ↓
Feature Service
   ↓
ApiClientService
   ↓
HTTP
   ↓
ApiResponse<T>
   ↓
Feature Service unwraps body
   ↓
Component receives domain model
```

Feature services throw an `ApiException` `{ statusCode, clientMessage, errors }` when the HTTP call fails or when a 2xx body has a non-null `errors` map. Components do not import `ApiResponse`. Login field errors are the exception in section F: `LoginComponent` reads `errors` from `ApiException`, not from the envelope.

### `ApiClientService`

File: `api-client.service.ts`.  
Justification: one HTTP entry so feature services cannot invent a second client.  
Methods: `get<T>(url, params)`, `post<T>(url, body)`.  
Both return `ApiResponse<T>`. They do not return `body` and they do not throw `ApiException`.  
Used by `AuthService`, `ProjectService`, `PageService`, and `MetadataService`.

### `AuthService`

Responsibility: login, logout, session read, role checks.  
Endpoint: `POST /api/auth/login` only.  
Methods: `login`, `logout`, `clearSession`, `isLoggedIn`, `getUsername`, `getUserRoles`, `hasRole`, `getToken`.  
`login` calls `ApiClientService`, unwraps `body` on success, and writes `gsuif.auth`. On failure it throws `ApiException` and does not notify or navigate.  
`clearSession` removes `gsuif.auth` and does not navigate. `logout` calls `clearSession` and navigates to `/login`. `ErrorInterceptor` uses `clearSession` once for a non-login 401 and then navigates once. It does not also call `logout`.  
Consumers: `LoginComponent`, `AuthGuard`, `AuthInterceptor`, `ErrorInterceptor`, `AppComponent`, `HomeComponent`.

### `ProjectService`

Responsibility: read projects.  
Endpoints: `GET /api/v1/projects`, `GET /api/v1/projects/{id}`.  
Calls `ApiClientService` and unwraps `body` before returning `PagedBody<Project>` or `Project`.  
Methods: `list(page: number)`, `getById(id: string)`.  
`list` sends `page`, `size=20`, `sort=createdAt,desc`.  
Consumers: `ProjectListComponent`, `ProjectDetailComponent`.

### `PageService`

Responsibility: read pages.  
Endpoints: list and get-by-id under `/api/v1/projects/{projectId}/pages`.  
Calls `ApiClientService` and unwraps `body` before returning `PagedBody<Page>` or `Page`.  
Methods: `list(projectId, page)`, `getById(projectId, pageId)`.  
List sort: `createdAt,desc`. Size 20.  
Consumers: `ProjectDetailComponent`, `VersionHistoryComponent`.

### `MetadataService`

Responsibility: read version history.  
Endpoint: `GET /api/v1/pages/{pageId}/metadata`.  
Calls `ApiClientService` and unwraps `body` before returning `PagedBody<MetadataVersion>`.  
Method: `list(pageId, page)` with `sort=version,desc` and `size=20`.  
Do not add `latest` or `current` methods in this scope.  
Consumer: `VersionHistoryComponent`.

### `NotificationService`

Responsibility: the service named by STD-30.  
Methods: `show(message: string)`, `clear()`.  
No HTTP. Holds one current message for the shared notification banner.  
Consumers: `ErrorInterceptor` for non-login errors, and `LoginComponent` for the login 401 and login 400 notification. Those two paths do not both notify for the same response.

### `LoadingService`

Responsibility: a shared busy flag for a region, not STD-31.  
Methods: `begin(key)`, `end(key)`, `isBusy(key)`.  
SCRUM-68 creates it so every screen uses the same loading presentation. The pending-count `LoadingInterceptor` is SCRUM-72 and is not implemented now.

---

## J. Data Models

Place these in `core/models`. Match the backend names. Do not add fields.

### `ApiResponse<T>`

`status: string`, `clientMessage: string`, `statusCode: number`, `body: T | null`, `errors: Record<string, string> | null`.  
Used by `ApiClientService` and by the feature services that unwrap it. Not imported by components.

### `PagedBody<T>`

`data: T[]`, `totalPages: number`, `totalElements: number`, `size: number`, `number: number`.

### `LoginRequest`

`username: string`, `password: string`.

### `AuthSession`

Stored shape, from `AuthResponse`: `token: string`, `tokenType: string`, `username: string`, `roles: string[]`.

### `Project`

`id: string`, `name: string`, `description: string | null`, `createdAt: string`, `updatedAt: string`, `createdBy: string`, `lastModifiedBy: string`.  
`description` is null when absent. Do not add `pageCount` or `status`.

### `Page`

`id: string`, `projectId: string`, `name: string`, `route: string | null`, `createdAt: string`, `updatedAt: string`, `createdBy: string`, `lastModifiedBy: string`.  
Do not add `currentMetadataVersionId`.

### `MetadataVersion`

`id: string`, `pageId: string`, `projectId: string`, `version: number`, `schemaVersion: string`, `isCurrent: boolean`, `snapshot: object`, `createdAt: string`, `updatedAt: string`, `createdBy: string`, `lastModifiedBy: string`.  
`snapshot` is a JSON object. Do not type it as a closed component enum. Component `type` is an open string in `metadata/schema/component.schema.json`. The screen shows the object as JSON. It does not edit it.

### `ApiException`

Frontend-only. `statusCode: number`, `clientMessage: string`, `errors: Record<string, string> | null`. Not a backend DTO.

Dates are ISO strings as returned by Jackson. Display them with the browser locale. Do not reformat them into a second calendar system.

---

## K. Pagination

Backend facts:

- Send `page` as a zero-based integer.
- Send `size=20` on every list request. This plan does not add a page-size control, because Jira does not require one. Never send a size above 100.
- Send the default sort for that resource. Do not add a sort dropdown. An invalid sort is HTTP 400.
- Read `number` as the current zero-based page.
- Read `totalPages` and `totalElements` for the footer.
- `data` is the current page only.

UI:

- Show “Page {number + 1} of {totalPages}” and “{totalElements} items”.
- Previous is enabled when `number > 0`. Next is enabled when `number + 1 < totalPages`.
- Previous sends `page = number - 1`. Next sends `page = number + 1`.
- If `totalPages` is 0, show the empty state and hide the pager.
- Changing route resets `page` to 0.
- Do not invent search or filters.

---

## L. Feature-by-Feature Implementation Plan

Implement in order: SCRUM-68, SCRUM-69, SCRUM-70, SCRUM-71. Do not start a later ticket’s screens inside an earlier ticket. Shared visual pieces are created once in SCRUM-68 and only consumed afterward.

Each task’s verification is in its own section below. Global verification is section X and section AC.

---

## M. SCRUM-68 Detailed Plan

### 1. Goal

Create the Angular 17+ application, the STD-07 folders, `app-routing.module.ts`, the dev proxy, the app shell, and the shared visual primitives. No login form and no metadata table yet.

### 2. Inputs

SCRUM-68 text. STD-07. Approved proxy decision. Sections Q, S, and T of this plan.

### 3. Files to create

- Angular project files from the CLI (`angular.json`, `package.json`, `tsconfig*.json`, `src/main.ts`, `src/index.html`, `src/styles.css`).
- `proxy.conf.json`.
- `src/app/app.module.ts`
- `src/app/app-routing.module.ts`
- `src/app/app.component.ts`, `.html`, `.css`
- `src/app/core/core.module.ts`
- `src/app/core/guards/.gitkeep`
- `src/app/core/interceptors/.gitkeep`
- `src/app/core/services/notification.service.ts`
- `src/app/core/services/loading.service.ts`
- `src/app/core/models/.gitkeep`
- `src/app/shared/shared.module.ts`
- `src/app/shared/ui/` components from section T that do not need feature data: `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `NotificationBanner`
- `src/styles/tokens.css` imported once from `styles.css`

CLI flags follow the exact Angular version selected by the procedure below. The required result is `app-routing.module.ts` plus the folders above. Record that exact Angular version and the Node.js version in the task report before generating files. Do not leave the report as `17+`.

### 4. Files to modify

`angular.json` so `serve` uses `proxy.conf.json`. `src/styles.css` to import tokens only.

### 5. Sequence

1. Before scaffolding or changing the Angular project:
   1. Detect the installed Node.js version.
   2. Detect the installed Angular CLI version, if available.
   3. If an Angular project already exists, inspect `package.json` and use the actual configured Angular version.
   4. If the project is still empty and scaffolding is required, select one exact Angular version that satisfies Angular 17+ and is compatible with the available Node.js environment. Do not choose a version merely because it is the newest available.
   5. Record the exact Angular version and Node.js version in the implementation report before coding continues.
   6. Do not silently switch Angular versions later.
   If more than one compatible version is available and none is already configured, stop and ask which exact version to pin. Do not guess.
2. Generate the project with routing modules, not a standalone-only skeleton that lacks `app-routing.module.ts`. If the CLI emits standalone defaults, adapt the generated project only enough to keep `app-routing.module.ts` and the section G folders.
3. Add the STD-07 folders and modules.
4. Add tokens, shared primitives, shell, and proxy.
5. Add a single public route that renders the shell and a `PageHeader` with title “GSUIF”. This placeholder is replaced by `/login` in SCRUM-69. Until then, `/` shows the shell only.
6. Run `ng serve` and confirm it compiles.

### 6. Logic

No HTTP calls. `NotificationService` and `LoadingService` exist and are unused by a screen.

### 7. UI

Shell and tokens only. The placeholder page uses `PageHeader` and body text: “Frontend skeleton.” No cards of fake data.

### 8. API integration

None.

### 9. Error handling

None.

### 10. Loading

`LoadingState` exists and is not mounted.

### 11. Empty state

`EmptyState` exists and is not mounted.

### 12. Responsive behavior

The top bar stacks the product name above the nav below 640px. Page padding uses the spacing tokens. No horizontal scroll at 320px width for the shell.

### 13. Animation

Shell uses no entrance animation beyond the shared route fade in section S, once routing exists.

### 14. Accessibility

One `h1` inside `PageHeader`. Skip link as the first focusable control. Focus outline uses the token, not `outline: none`.

### 15. Validation

`ng serve` starts without a compile error. Folder tree matches section G. `proxy.conf.json` targets only `http://localhost:8080` for `/api`.

---

## N. SCRUM-69 Detailed Plan

### 1. Goal

A real login flow against `POST /api/auth/login`, with guard, interceptors, and `sessionStorage`.

### 2. Inputs

Section F. `AuthController.java`, `LoginRequest.java`, `AuthResponse.java`, `JwtAuthenticationFilter.java`, `GlobalExceptionHandler.java`.

### 3. Files to create

- `src/app/core/models/api-response.model.ts`
- `src/app/core/models/auth-session.model.ts`
- `src/app/core/models/api-exception.model.ts`
- `src/app/core/services/api-client.service.ts`
- `src/app/core/services/auth.service.ts`
- `src/app/core/guards/auth.guard.ts`
- `src/app/core/interceptors/auth.interceptor.ts`
- `src/app/core/interceptors/error.interceptor.ts`
- `src/app/features/auth/auth.module.ts`
- `src/app/features/auth/login/login.component.ts`, `.html`, `.css`

### 4. Files to modify

`app-routing.module.ts`, `app.module.ts`, `app.component.ts` and its template (logout control). Remove the skeleton placeholder route.

### 5. Sequence

1. Models and `ApiClientService`.
2. `AuthService` and storage.
3. Interceptors, registered in this order: auth interceptor, then error interceptor.
4. Guard.
5. Login screen.
6. Routes: `/login` public; empty path redirects to `/login`.
7. Logout in the shell.

### 6. Logic

Follow section F exactly. Reactive form: `username` and `password`, both required. Disable submit while the request is in flight. Trim is not required before send; the backend rejects blank values.

### 7. UI

A single column, max width 28rem, centered vertically in the content area. `PageHeader` title “Sign in”. Two fields, one primary button “Sign in”. No registration link. No “forgot password” link. Those flows do not exist.

### 8. API integration

`POST /api/auth/login` with the form value. `AuthService` calls `ApiClientService`, receives `ApiResponse`, and unwraps `body`. The component receives the session outcome, not the envelope.

### 9. Error handling

Section F. 401 stays on `/login`. Network failure with no body: notification “Unable to reach the server.” Do not navigate.

### 10. Loading

`LoadingService` key `login`. The button label becomes “Signing in” and is disabled. No full-page spinner.

### 11. Empty state

Not applicable.

### 12. Responsive behavior

The form is full width of its column. On viewports below 640px the column uses the page padding token instead of a floating card margin.

### 13. Animation

The form uses the shared fade in section S. The error notification uses the shared banner motion. No shake animation on error.

### 14. Accessibility

Labels bound to inputs. `autocomplete="username"` and `autocomplete="current-password"`. Submit with Enter. Error text is in an `aria-live="polite"` region. Focus moves to the first invalid field on 400.

### 15. Validation

With the backend running and a local user: valid login reaches `/home` and `sessionStorage` contains `gsuif.auth` and no other authentication key. Wrong password stays on `/login` and shows the backend message once. Reload on `/home` while the token remains keeps the user in the app. Logout clears the key and opens `/login`. A direct visit to `/home` without a token opens `/login`, and the next successful login still opens `/home` with no `returnUrl`.

Unit tests for this ticket are the AuthService, AuthInterceptor, ErrorInterceptor, and login envelope cases in section V. Do not delete a failing test to make the suite pass.

---

## O. SCRUM-70 Detailed Plan

### 1. Goal

A protected `/home` page with a welcome line and one navigation path into the metadata browser.

### 2. Inputs

SCRUM-70. Approved route `/projects`. `AuthService.getUsername()`.

### 3. Files to create

- `src/app/features/home/home.module.ts`
- `src/app/features/home/home.component.ts`, `.html`, `.css`

### 4. Files to modify

`app-routing.module.ts` to add `/home` with `AuthGuard`. After login, `AuthService` already navigates to `/home`.

### 5. Sequence

1. Home module and component.
2. Route.
3. Confirm the guard.
4. Link to `/projects`.

### 6. Logic

No HTTP. Welcome text, because Jira does not supply copy: `Welcome, {username}.` when username is non-empty. Otherwise `Welcome.` This is a plan rule derived from the stored login field, not a new API.

### 7. UI

`PageHeader` title “Home”. One sentence of welcome text. One link or button “Browse metadata” that routes to `/projects`. No charts, counts, recent-activity lists, or status tiles.

### 8. API integration

None.

### 9. Error handling

Guard only.

### 10. Loading

None.

### 11. Empty state

Not applicable.

### 12. Responsive behavior

The action sits under the welcome text. Full width below 640px. Beside the text from 960px upward, still one action.

### 13. Animation

Shared route fade only.

### 14. Accessibility

The browse control is a real link or button with the name “Browse metadata”. It is in the tab order.

### 15. Validation

Signed out, `/home` redirects to `/login`. Signed in, the welcome line shows the username and the control opens `/projects` (the list can be empty).

---

## P. SCRUM-71 Detailed Plan

### 1. Goal

Read-only project list, project detail with pages, and version history with a JSON snapshot.

### 2. Inputs

Section E GET endpoints. `ProjectDto`, `PageDto`, `MetadataVersionDto`. STD-32.

### 3. Files to create

- `src/app/features/metadata/metadata.module.ts`
- `src/app/features/metadata/project-list.component.ts` and template
- `src/app/features/metadata/project-detail.component.ts` and template
- `src/app/features/metadata/version-history.component.ts` and template
- `src/app/core/services/project.service.ts`
- `src/app/core/services/page.service.ts`
- `src/app/core/services/metadata.service.ts`
- `src/app/core/models/project.model.ts`
- `src/app/core/models/page.model.ts`
- `src/app/core/models/metadata-version.model.ts`
- `src/app/shared/ui/data-table`
- `src/app/shared/ui/pagination`
- `src/app/shared/ui/breadcrumbs`
- `src/app/shared/ui/json-viewer`
- `src/app/shared/ui/status-badge`

### 4. Files to modify

`app-routing.module.ts` with the three metadata routes, all guarded. Home already links to `/projects`.

### 5. Sequence

1. Models and three read services.
2. Shared table, pager, breadcrumbs, JSON viewer, badge.
3. Project list.
4. Project detail.
5. Version history.
6. Wire routes and breadcrumbs.

### 6. Logic

List pages start at `page=0`. Row activation navigates. Project detail loads the project and the first page of pages as two requests with independent loading and error regions, as specified in section H. Version screen loads the page header, then version page 0.

```text
After a successful version-list request:

If at least one version exists:
- automatically select the first returned version.

The backend default ordering is version descending, so the first returned row is the highest version under the approved default ordering.

If the list is empty:
- no version is selected
- show the approved empty state
- do not fabricate a snapshot

Selecting another version replaces the displayed snapshot.
```

Do not call `/metadata/current`. Do not invent a current-version endpoint.

`isCurrent === true` displays the text “Current”. `isCurrent === false` shows no Current badge. Do not display “Latest”, “Most Recent”, or “Newest”. The highest version number is not the current-version pointer. Do not badge the first row as current merely because the sort is `version,desc`.

### 7. UI

Project list columns: name, description, updated. Description blank when null.  
Project detail: name, description, audit lines `createdBy` and `updatedAt`, then the page table. Page columns: name, route, updated. Route blank when null.  
Version columns: version number, schemaVersion, current badge, createdAt, createdBy. Snapshot pane title “Snapshot”. Read-only.

### 8. API integration

Only the GET calls in section E. No POST, PUT, or DELETE.

### 9. Error handling

Show `ErrorState` with `clientMessage` and a Retry button that repeats the same GET. 404 on a detail route also offers a link to the parent list. Do not clear the session unless the status is a non-login 401.

On project detail, a failed pages request does not hide a project that already loaded. A failed project request does not render invented project fields and does not render a page table as if the project existed. Do not fabricate rows after any failed request.

### 10. Loading

`LoadingState` replaces the table body until the matching request finishes. The header can render when its own request finishes, even if the table is still loading.

### 11. Empty state

Project list: “No projects yet.” Page list: “This project has no pages.” Versions: “This page has no metadata versions.” No snapshot pane in that case.

### 12. Responsive behavior

`DataTable` is one component. From 960px upward it renders a table. Below that, the same component renders each row as a stacked definition list using the same fields. Do not create a separate desktop table and a separate mobile table. Do not copy project, page, or version row markup into the feature components. The snapshot pane moves below the list. No horizontal page scroll at 320px. Responsive behavior uses the section Q tokens and the accessibility rules below.

### 13. Animation

Route fade. Table rows do not stagger. The snapshot pane fades when the selected version changes.

### 14. Accessibility

Tables use `th` with scope, or the stacked pattern uses labeled text. Row links have an accessible name equal to the entity name. The snapshot is in a region named “Snapshot”. Pagination buttons have names “Previous page” and “Next page”.

Color must never be the only indicator of meaning. The Current state includes the text “Current”, not only a color. Error states include text, not only red styling. Success or current styling includes text or another non-color indicator.

### 15. Validation

Against a running backend that already contains at least one project, page, and version: the three screens show those values, including a null description and a null route without the word “null”. Pagination requests send `page=0` first and `page=1` after Next. The first returned version is selected without a “Latest” label. A component file under `features/metadata` does not reference `ApiResponse`. No create, edit, delete, compare, export, or generate control is present.

Unit tests for envelope unwrapping and pagination are in section V. Do not delete a failing test to make the suite pass.

---

## Q. Global Design System

NOT FOUND in Jira, STD-07, or the backend. The tokens below are the plan convention. Implement them once in `src/styles/tokens.css`. Feature CSS may only use these variables. A feature that introduces a new hex color, font, or radius has failed review.

Visual direction: a light, dense engineering surface. Ink text, a single blue accent, monospace for identifiers and JSON. No purple gradient, no glassmorphism, no illustration hero.

### Color

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#f4f6f8` | Page background |
| `--color-surface` | `#ffffff` | Bar, cards, tables |
| `--color-ink` | `#14202b` | Primary text |
| `--color-muted` | `#5c6b78` | Secondary text |
| `--color-line` | `#d5dee6` | Borders, table rules |
| `--color-accent` | `#0f5c75` | Links, primary button, focus |
| `--color-accent-ink` | `#ffffff` | Text on accent |
| `--color-danger` | `#8f2d2d` | Errors |
| `--color-danger-bg` | `#f8e8e8` | Error banner background |
| `--color-ok` | `#1f6b45` | Current badge text |
| `--color-ok-bg` | `#e5f4ec` | Current badge background |

### Typography

- UI: `"Segoe UI", system-ui, sans-serif`
- Identifiers, version numbers, JSON: `ui-monospace, "Cascadia Code", Consolas, monospace`
- Sizes: 12px metadata, 14px body, 20px page title, 28px login title
- Line height: 1.45
- Do not load a web font.

### Spacing, radius, shadow, surfaces

- Space unit 4px. Use 8, 12, 16, 24, 32, 48 only.
- Page padding 16px below 640px and 24px above.
- Radius 4px on controls and 8px on surfaces. No full pills except the Current badge.
- Shadow: `0 1px 2px rgba(20, 32, 43, 0.06)` on the top bar and the login column only.
- Surfaces are white on `--color-bg`. Nested cards do not get a second shadow.

### Controls

- Primary button: accent background, accent ink text, height 36px, horizontal padding 16px.
- Secondary button: surface background, line border, ink text.
- Disabled: 40% opacity, no pointer events.
- Inputs: height 36px, line border, 8px horizontal padding. Focus: 2px accent outline, offset 2px.
- Tables: full width, header text 12px uppercase with 0.04em tracking, row padding 12px vertical. Row hover background `#eef3f6`.
- Badge Current: ok colors, 12px text, radius 999px, padding 2px 8px.
- Page header: title plus optional muted description, margin-bottom 24px.
- Breadcrumbs: muted links separated by `/`, current crumb is ink and not a link.
- Notification: one banner under the top bar, danger colors, dismiss control.
- Loading: the sentence “Loading.” plus a 2px accent bar, 4px tall, across the top of the region. No custom spinner graphic.
- Empty and error: muted text, one sentence, optional retry button. No illustrations.
- JSON viewer: monospace, 12px, preformatted, overflow auto, max height 24rem, line background `--color-bg`.

### Accessibility

These rules apply to every screen, in addition to the per-ticket notes:

- Color must never be the only indicator of meaning.
- Current state includes the text “Current”, not only a color.
- Error states include text, not only red styling.
- Success states include text or another non-color indicator where a success state exists. This scope has no separate success toast.
- Keep visible focus, keyboard operation, labels, the skip link, and `aria-live` for notifications.

---

## R. Non-Traditional Professional UI Direction

The product is a metadata browser for people who generate software, not a consumer dashboard. Hierarchy comes from the page title, then the entity name, then monospace identifiers. Density stays closer to a technical directory than to a marketing page: 14px body, visible table rules, almost no decoration.

Every screen uses `PageHeader`, the same top bar, and the same content width: max 1120px, centered. Login is the only narrow column. Do not add a second navigation pattern inside a feature.

Future generation screens, when a contract exists, must use these tokens, the same shell, and the same table and banner components. They must not introduce a new accent color.

---

## S. Animation / Motion System

NOT FOUND in project sources. One system:

| Pattern | Duration | Easing | Distance | Use |
|---|---|---|---|---|
| Route fade | 160ms | `ease-out` | none, opacity 0 to 1 | Each routed screen |
| Banner in | 160ms | `ease-out` | 8px down | Notification |
| Snapshot swap | 120ms | `ease-out` | none | JSON pane when selection changes |
| Hover | 120ms | `ease-out` | none | Table row background, button background |
| Button press | none | n/a | none | Native active state only |

No slide-in drawers, no staggered lists, no looping animation except the loading bar, which is a static bar in this plan (no indeterminate loop). If a later change adds an indeterminate bar, it must stop under `prefers-reduced-motion: reduce`.

Under `prefers-reduced-motion: reduce`, set all durations to 0ms. Do not animate route changes.

---

## T. Reusable Component System

| Component | Created | Consumed by |
|---|---|---|
| App shell (top bar, skip link, outlet, notification host) | SCRUM-68, logout in SCRUM-69 | Every route |
| `PageHeader` | SCRUM-68 | Login, home, all metadata screens |
| `NotificationBanner` | SCRUM-68 | Error interceptor, login 401 |
| `LoadingState` | SCRUM-68 | Metadata regions in SCRUM-71, login button stays local |
| `EmptyState` | SCRUM-68 | Three metadata empty cases |
| `ErrorState` | SCRUM-68 | Failed GETs |
| `Breadcrumbs` | SCRUM-71 | Project detail, version history |
| `DataTable` | SCRUM-71 | Projects, pages, versions |
| `Pagination` | SCRUM-71 | Those three lists |
| `StatusBadge` | SCRUM-71 | `isCurrent` |
| `JsonViewer` | SCRUM-71 | Selected snapshot |

Do not build a modal, drawer, or chart component. Nothing in scope needs them.

`DataTable` stays one reusable component. It supports a desktop table presentation and a mobile stacked presentation. Do not create separate unrelated desktop and mobile table components. Do not duplicate the project, page, or version table logic in the feature screens. Responsive behavior stays on the section Q tokens and the accessibility rules in section Q.

---

## U. Skills / AI Workflow

These tools are not project requirements. They are the implementation workflow. If a tool is not installed, follow this plan anyway and do not block SCRUM-68 on installing it. Skills and tools assist the workflow but never override this plan. Do not send secrets to any of them.

Availability was checked read-only on this machine: Taste, Impeccable, Awesome Design, UIUXpromax, Emil Kowalski, an Angular skill, and a Playwright skill are not installed. Graft, Claudex Loop, and OmniRoute were not verified as installed. Installing any skill requires explicit human approval and must stay compatible with this plan.

### Graft

Repository: `https://github.com/trailhq/Graft`.

Before each ticket, load only that ticket’s section of this plan plus the backend files named in that section. Exclude `.env`, `.env.*`, `*.local.md`, `application-local.yml`, `application-test.yml`, and any file whose name contains `secret`, `credential`, or `token`. Do not index the backend JWT material. Reuse this plan instead of re-sending the whole backend tree.

### Claudex Loop

Repository: `https://github.com/chaseai-yt/claudex-loop`.

Use the role order in section V. The builder does not approve its own plan or its own diff. If the loop tool is unavailable, the same roles still apply: Cursor orchestrates a planning pass, a separate critical pass, implementation by Codex Builder, then review passes on the diff.

### Codex

Codex Builder (Model A) is the primary builder and fixer. It may create and edit frontend files inside the current ticket’s file list. It may not add generation endpoints or change backend code. Codex does not commit. Codex Builder and Codex Reviewer (Model B) must not execute Git write commands, push, open a pull request, merge, or change GitHub or Jira. Codex Reviewer is read-only. It must not “improve” the API shapes in section E or replace `app-routing.module.ts` with standalone-only routing.

Cursor is the orchestrator. It delegates implementation and fixes to Codex Builder, runs the checks, and performs the second read-only review. Cursor does not implement the ticket itself.

### Taste

Repository: `https://github.com/leonxlnx/taste-skill`.

Use while building shared primitives and again when a screen is first assembled. Check hierarchy, spacing, and alignment against section Q. It must not replace the tokens.

### Impeccable

Repository: `https://github.com/pbakaus/impeccable`.

Use on the finished screen of each ticket for consistency, focus states, and contrast against the tokens. It must not introduce a component library.

### Awesome Design Skills

Repository: `https://github.com/bergside/awesome-design-skills`.

Use only if a layout problem in section Q is unclear. Do not import an unrelated design system or a new color palette.

### Emil Kowalski Skills

Repository: `https://github.com/emilkowalski/skills`.

Use only to check that motion matches section S: duration, easing, and reduced motion. Do not add extra transitions.

### OmniRoute

Repository: `https://github.com/diegosouzapw/OmniRoute`.

Use only when the current model is unavailable. It does not change the plan or the API contract. After a switch, continue at the current ticket and step. Do not restart discovery.

### Playwright Skill

Repository: `https://github.com/lackeyjb/playwright-skill`.

The Playwright skill is not currently installed. The real Playwright runner, added only as a devDependency, is still required by section X regardless of any skill.

Use, if installed, for the scenarios in section X after SCRUM-69, SCRUM-70, and SCRUM-71. Point it at `ng serve` and the real backend. Assert the real request URLs and query values in section X. Fail on unexpected console errors. Do not add route mocks for `/api/auth/login` or `/api/v1/**`.

---

## V. AI Agent Workflow

```text
1. Read the current ticket section of this plan
2. Graft only the files named in that section
3. Planner writes a short task note that quotes the endpoints it will call
4. Plan reviewer rejects the note if it adds an endpoint, a field, or a visual token
5. Codex Builder (Model A) implements only the files listed for that ticket
6. Production build or ng serve compile
7. Typecheck
8. Lint, if the Angular project generated a lint target
9. Unit tests listed under “Core unit tests” in this section. Do not weaken or delete them
10. Playwright for the scenarios that ticket can actually run
11. Codex Reviewer (Model B, read-only) reads the diff against this plan, then Cursor (read-only) performs a second review
12. Codex Builder fixes valid findings
13. Re-run the failed check only
14. Final review (Codex Reviewer and Cursor confirm no unresolved blocking finding)
15. Update the checklist in section AD
16. Git handoff: the agent gives the human the exact Git commands (add, commit, push, pull request, merge). The human runs them. No agent runs them
17. Report in the form required by the human’s agent instructions
```

Role flow: Cursor orchestrates, Codex Builder builds, the checks run, Codex Reviewer reviews, Cursor reviews, Codex Builder fixes, the checks run again, the human performs the final review, then the human performs all Git and GitHub operations.

Branch precondition: before step 1, the agent reports `git branch` and `git status`. It works only on the human-created feature branch for the current ticket (section Z). If the current branch is `main`, `develop`, `master`, or any other base branch, it stops.

Maximum three fix rounds per ticket. If valid findings remain after the third round, stop and ask the human, reporting the findings, the attempts, and the files. Do not restart SCRUM-68 because a later ticket failed.

### Core unit tests

Add tests for core logic only. Do not add a unit test for every visual component. Do not weaken or delete a test to make the suite pass.

AuthService, added with SCRUM-69:

- successful login stores `gsuif.auth` and does not log the token
- failed login does not write storage and does not navigate
- logout removes `gsuif.auth`
- `isLoggedIn` is true only when the stored token is non-empty
- `getUserRoles` returns the stored array, or an empty array
- `hasRole` matches the exact stored string

AuthInterceptor, added with SCRUM-69:

- when a token exists, the outgoing request has `Authorization: Bearer <stored JWT>`
- when no token exists, the request is not given a fake token

ErrorInterceptor, added with SCRUM-69:

- `POST /api/auth/login` with HTTP 401 does not clear storage and does not redirect
- any other HTTP 401 clears the auth state and redirects to `/login`

API envelope handling, started with `AuthService` in SCRUM-69 and repeated by the read services in SCRUM-71:

- a successful `ApiResponse<T>` causes the feature service to return `body`
- an error response causes the feature service to expose `ApiException` with `statusCode`, `clientMessage`, and `errors`
- `ApiClientService` returns the envelope and does not unwrap it

Pagination, added with SCRUM-71:

- first page disables Previous
- last page disables Next
- a middle page enables the appropriate control
- the outgoing request uses a zero-based `page`

---

## W. Review Rules

### Plan review

Reject the task note if it names an endpoint not in section E, a frontend route not in section H, a color not in section Q, a committed credential, or a generation control.

### Code review

Check the diff for: STD-07 paths, `app-routing.module.ts`, relative `/api` URLs, envelope unwrapping only in feature services, `ApiClientService` returning the envelope, login 401 not redirecting and not double-notifying, other 401 clearing the session once and redirecting once, zero-based `page`, no `ApiResponse` in components, one `gsuif.auth` key, no `returnUrl`, no “Latest” label, one `DataTable`, no new hex values outside `tokens.css`, no unapproved dependency or UI framework, focus outlines present, and no files outside the ticket list.

Severity: blocking if the API or the 401 rule is wrong; important if a screen bypasses a shared component; minor for spacing within the token scale.

### Fix loop

Maximum three fix rounds per ticket, the same limit as section V. After the third unsuccessful round, stop and ask the human. A repeated root cause may stop the loop earlier. Reviewers are read-only; only Codex Builder applies fixes. Do not delete a failing test to pass.

---

## X. Playwright Verification Plan

Run against `ng serve` with the proxy and a local backend. Do not intercept `/api` with fake JSON.

During Playwright verification:

- capture browser console messages
- fail on unexpected `console.error` messages
- fail on unexpected page errors and unhandled exceptions
- fail on failed resource requests where they show the application is broken

Unexpected application errors fail verification. A known or intentional browser message may be ignored only when that message is written in the test report. Do not ignore all console errors globally.

For the relevant tickets, verify that the frontend calls the real backend. Do not pass a scenario only because UI text appeared when the test can also see the request.

```text
POST /api/auth/login
GET /api/v1/projects
GET /api/v1/projects/{projectId}
GET /api/v1/projects/{projectId}/pages
GET /api/v1/pages/{pageId}/metadata
```

Pagination must show the real query `page=0` and, when a next page exists, `page=1`. Do not intercept `/api` with mock responses.

Authentication, after SCRUM-69:

- Submit empty fields. Expect no navigation. Expect the required-field UI. Do not require a specific backend call if the form blocks submit.
- Submit a wrong password. Expect HTTP 401, the backend `clientMessage` on screen, URL still `/login`, and no `gsuif.auth` entry.
- Submit the locally provisioned user. Expect URL `/home` and a stored token. The test must read the password from an environment variable supplied at runtime, never from the repository.
- Reload `/home`. Expect to remain signed in.
- Activate logout. Expect `/login` and no stored token.
- Visit `/home` signed out. Expect `/login`.
- Protected API 401: UNRESOLVED while security mode is `dev`. Skip this scenario and record the skip. Do not fake a 401 with a mock. Run it only when the backend is confirmed to be in `test` or `prod` mode.

Navigation, after SCRUM-70 and SCRUM-71:

- Home “Browse metadata” opens `/projects`.
- A real project row opens `/projects/{id}`.
- A real page row opens `/projects/{projectId}/pages/{pageId}/versions`.

Backend integration, after SCRUM-71:

- Project name from the API is visible.
- Page name and a null route do not show the text “null”.
- A version number and `schemaVersion` are visible.
- `isCurrent` true shows the word “Current”.
- No row shows “Latest”, “Most Recent”, or “Newest”.
- When versions exist, the first returned row’s snapshot is visible without an extra click.
- Next sends `page=1` when `totalPages` is greater than 1. If the local data has only one page, assert that Next is disabled. Do not invent extra rows.

UI:

- Loading text “Loading.” appears before data, or the data is already visible if the response is immediate. Do not fail solely on a missed loading frame if the data is correct.
- Empty copy appears when a list `totalElements` is 0. If the local database is not empty, do not delete data to force this. Record that the empty case was not executed.
- Stop the backend and retry a list. Expect “Unable to reach the server.” or the browser’s failed-request notification, and no crash.
- Viewports 1280, 768, and 375. No horizontal overflow on the shell and the project list.
- `prefers-reduced-motion: reduce` does not leave a looping animation.
- Tab from the skip link to the first field on `/login`, then Enter to submit.

---

## Y. Security Rules

Never copy, quote, log, or commit:

- `.env` and `.env.*`
- `*.local.md`
- secret values from backend `application-local.yml` and `application-test.yml`, including the JWT secret and the database password. Those files may be read to confirm a port or a profile. Their secret values must never leave the backend repository
- private keys, certificates, cloud credentials, API keys
- the JWT value, in logs, screenshots, Playwright traces, or git history

The Playwright password comes from the process environment at run time. The test prints only the HTTP status, not the request body.

Do not put a default username or password in source, fixtures, or this plan.

---

## Z. Git and GitHub Rules

### Read operations agents may run

- `git status`
- `git diff`
- `git log`
- `git show`
- `git branch` (listing only)
- `git remote -v`
- read-only GitHub inspection, where available

### Write operations reserved for the human

- `git add`
- `git commit`
- `git push`
- branch creation and branch deletion
- remote creation or change
- pull request creation and merge
- GitHub repository creation and GitHub repository or settings changes
- Jira changes

Agents never perform these writes. This holds even if the human approved an earlier checkpoint. Cursor, Codex Builder, and Codex Reviewer all follow it. The human performs every Git and GitHub write.

Stop and ask before any of these. Do not perform them because they look useful:

- deploying
- adding an npm dependency that this plan does not already require
- changing the API contract in section E
- changing the design system in sections Q and S

### Frontend branch workflow (human-approved project decision)

```text
main → develop → feature/SCRUM-XX-description
```

- This follows the backend convention (section C, backend Git evidence). The frontend base branch is `develop` by project decision. It is not established by previous frontend repository evidence, and the frontend `develop` branch must be created by the human on GitHub.
- The human creates every ticket feature branch. One branch per ticket, from the current `develop`.
- Branch names for the current scope (project workflow decisions):
  - SCRUM-68: `feature/SCRUM-68-angular-skeleton`
  - SCRUM-69: `feature/SCRUM-69-login-guard-interceptors`
  - SCRUM-70: `feature/SCRUM-70-home`
  - SCRUM-71: `feature/SCRUM-71-metadata-browser`
- Commit messages: `[SCRUM-XX] Short description`.
- The agent never works on `main`, `develop`, `master`, or any other base branch. Before any work on a ticket, the agent reports `git branch` and `git status`, and stops if the current branch is not that ticket's feature branch.
- Work on one ticket at a time. The next ticket's branch is created by the human only after the previous ticket is merged and the human has updated the local `develop`.
- The local `master` branch is a one-time human setup matter, because the GitHub default branch is `main`. Agents do not rename or create branches.
- A pull request title convention and a merge type (merge commit or squash) for the frontend are not established by available project evidence. Do not assume one; the human chooses when opening the pull request.

### Handoff after a ticket passes

After the implementation, checks, Codex Reviewer, Cursor review, and the human's own review all pass, the agent gives the human the exact commands for `git add`, `git commit` with a `[SCRUM-XX] Short description` message, `git push`, pull request creation, and merge. The agent does not execute any of them. Before the handoff, the agent reports the branch, remote, files changed, and `git status` including untracked files, from read-only commands.

Do not commit `node_modules`, `dist`, `.angular`, environment files, secrets, credentials, or Playwright traces that might contain a token. This applies to the files in the handoff `git add` command.

The GitHub repository is `https://github.com/MTS-GSUIF-Graduation-Project/gsuif-Frontend`. The local workspace had no remote when this plan was written. Adding the remote is a human Git write.

---

## AA. Explicit Non-Goals

Do not implement:

- Generation screens or buttons
- Calls to `/api/v1/generation/**`
- A mock generation API
- External AI providers
- Artifact registry or download UI
- Export UI
- Build-validation UI
- Supabase or any new database
- Project, page, or metadata create, update, or delete
- Work-order screens
- `/metadata/current`
- Registration, password reset, or refresh
- A second design system, icon set, or font download
- Angular Material, PrimeNG, Bootstrap, Tailwind, or another UI framework
- An npm dependency that is not required by this plan and recorded in the task report
- `returnUrl` after login
- A “Latest”, “Most Recent”, or “Newest” version label
- Fake projects in the UI
- Backend code changes, including CORS

---

## AB. Blockers and Future Work

| Item | Current status | Why it matters | Owner/ticket | Can frontend proceed? |
|---|---|---|---|---|
| Exact Angular version | Not pinned. Jira requires 17 or newer. Select one compatible version with the section M procedure and record the exact version and Node.js version | CLI flags differ by major | No Jira ticket found | Yes. The implementation report must name the exact version, not `17+` |
| Local user | NOT FOUND in schema seed | Login proof needs a real user | No Jira ticket found | Yes for code. Proof waits on a user created outside git |
| Non-login 401 under `dev` mode | Backend permits all requests | SCRUM-69’s second 401 rule cannot be observed | No Jira ticket found for changing mode | Yes for code. Playwright skip until mode is not `dev` |
| Welcome sentence | NOT FOUND in Jira | SCRUM-70 still needs text | No Jira ticket found | Yes. Use section O |
| `GET/PUT .../metadata/current` | Not in `MetadataVersionController` | Would change how “current” is loaded | SCRUM-46, In Progress | Yes. Use `isCurrent` on the list |
| Generation HTTP API | Not on `develop` | SCRUM-72 “see result” | SCRUM-48, To Do | No for SCRUM-72. Current scope does not need it |
| Generation provider | To Do | Blocks SCRUM-48 | SCRUM-28 | No |
| Template foundation | In Progress | Blocks SCRUM-28 | SCRUM-44 | No |
| Build validation API | Not on `develop` | Failed generation has no HTTP result | SCRUM-47, To Do | No |
| Artifact registry API | Not on `develop` | No artifact list to show | SCRUM-49, To Do | No |
| Export API | Not on `develop` | SCRUM-66 mentions export | SCRUM-64, To Do | No |
| External AI | To Do | Blocks SCRUM-66 | SCRUM-65 | No |
| WOMS metadata | To Do | Blocks SCRUM-66 | SCRUM-60 | No |
| SCRUM-66 demo | To Do | Blocks SCRUM-72 | SCRUM-66 | No |
| SCRUM-72 | To Do | Global spinner and generation path | SCRUM-72 | No |
| CORS configuration | Not in backend | Browser calls need the approved proxy | Fix text lives in SCRUM-72. No separate ticket | Yes, via proxy. Do not edit the backend |
| Role names | NOT FOUND | `hasRole` has no required role | No Jira ticket found | Yes. Store and compare strings only |
| Production frontend URL | NOT FOUND | No deploy target | No Jira ticket found | Yes for local scope |
| Local handoff file | NOT FOUND | Startup notes were not on disk | No Jira ticket found | Yes. Backend port 8080 is in `application.yml` |
| UI library and brand | NOT FOUND | Could fork the visual language | No Jira ticket found | Yes. Sections Q and S are binding for this plan |

---

## AC. Definition of Done

The current scope is complete only when all of the following are true:

- SCRUM-68 folders and `app-routing.module.ts` exist, and `ng serve` compiles. The report names the exact Angular version and the Node.js version.
- Proxy forwards `/api` to `http://localhost:8080` and no CORS edit was made in the backend.
- SCRUM-69 login, storage, guard, and both interceptors match section F, including the login 401 exception and the absence of `returnUrl`.
- SCRUM-70 `/home` is guarded and links to `/projects`.
- SCRUM-71 lists and details match live GET responses. Feature services unwrap the envelope. `ApiClientService` does not. There are no write or generation controls, and no “Latest” label.
- Tokens in section Q are the only colors. No unapproved UI framework or dependency was added. Motion matches section S, including reduced motion.
- Layout has no horizontal overflow at 375px width on the shell and project list. `DataTable` is one component.
- Focus outlines remain visible. Meaning is not conveyed by color alone.
- Typecheck succeeds. Lint succeeds when a lint target exists.
- The core unit tests in section V pass.
- Playwright scenarios that can run against the real backend have been executed, including the real request URLs and console-error check. Skipped 401 and empty-data cases are written down, not mocked.
- The diff contains no secrets, no `.env`, and no credential fixture.
- An independent review of the diff found no unresolved blocking API mistake.
- No agent committed, pushed, opened a pull request, merged, or edited GitHub or Jira. The human performed all Git and GitHub writes.
- A final report lists files, the backend commit used, test results, Playwright results, and remaining skips.

---

## AD. Final Implementation Checklist

```text
[ ] This plan read before coding
[ ] backend develop still at 99c90935279fd44dac6ab0969139a7d4b65384f8, or the contract was re-read
[ ] Angular version and Node.js version recorded as exact versions
[ ] Plan review passed for the current ticket
[ ] SCRUM-68 complete
[ ] SCRUM-69 complete
[ ] SCRUM-70 complete
[ ] SCRUM-71 complete
[ ] Build passes
[ ] Typecheck passes
[ ] Lint passes or no lint target exists
[ ] Core unit tests in section V pass
[ ] Playwright passes for the scenarios that can run
[ ] Playwright saw the real backend requests and did not mock /api
[ ] Unexpected browser console errors recorded or absent
[ ] Dev-mode 401 scenario recorded as skipped, not mocked
[ ] Security review: no secrets, no token logs
[ ] UI uses only section Q tokens
[ ] Motion uses only section S
[ ] No generation, export, or write-API UI
[ ] No unapproved dependency or UI framework
[ ] No mock of /api
[ ] Branch checked: current ticket feature branch, not main, develop, master, or another base branch
[ ] Local git status reviewed (read-only)
[ ] No agent Git writes: no add, commit, push, PR, merge, remote or branch change, GitHub change, or Jira edit
[ ] Codex Reviewer (Model B) review passed
[ ] Cursor review passed
[ ] No unresolved blocking findings (maximum three fix rounds per ticket respected)
[ ] Final report written
```

---

## Source-of-truth notes the implementer must not “fix”

- Jira SCRUM-25 describes login as `ApiResponse<{token}>`. The implemented body also has `tokenType`, `username`, and `roles`. Use the code.
- Jira SCRUM-69 says every 401 redirects. The approved decision and section F override that sentence for the login request only.
- Jira SCRUM-46 describes `/metadata/current`. Those methods are not in `MetadataVersionController.java` on this commit. Do not call them.
- Jira SCRUM-48 describes generation URLs. They are not implemented. Do not call them.
- `PageDto` does not expose the current-version foreign key. Use `isCurrent` on version rows.
- An earlier draft of this plan allowed a “Latest” label on the first version row. That label is withdrawn. Show “Current” only when `isCurrent` is true.

---

## AE. SCRUM-80 — Developer generation workspace

Backend revisions verified for this section (re-verify before integrating anything new):

- `develop` at `ba12ec80ea77444f059a47ff18d7e1da835ebf7a`: metadata reads, `GET`/`PUT /api/v1/pages/{pageId}/metadata/current`, and `POST /api/v1/pages/{pageId}/metadata` (`{schemaVersion, snapshot}`; the new version becomes current). The notes above about `/metadata/current` and generation URLs describe the older `99c9093` baseline and do not apply to SCRUM-80.
- PR #47 at `9482e1fc25f405f0ec7a780b9f39ffbcf0b9bbc4`, not yet merged: `POST /api/v1/generation/backend`, `GET /api/v1/generation/runs/{id}` with `backendPackage`, `GET /runs/{id}/artifacts/download?path=`, the `X-Generation-Run-Id`, `-Failure-Stage` and `-Failure-Code` headers, attempt replay, and the versioned contract registry.

Scope delivered in the frontend:

- Route `projects/:projectId/pages/:pageId/workspace`, lazy `WorkspaceModule`, linked from page detail, with an unsaved-changes guard.
- JSON metadata editor with local syntax location, backend errors by path, drafts in `sessionStorage` (`gsuif.workspace.draft.<pageId>`), and immutable-version saving.
- Specification editor; the contract dropdown sets `openApi.contractId` and `contractVersion`.
- BACKEND generation sent once per explicit action, with a client-generated attempt ID. Outcomes: success, rejected, failed (tracked), forbidden, not found, unauthenticated, attempt in use, attempt conflict, and unknown. No automatic retries and no automatic replacement attempt IDs. Unconfirmed attempts are kept as `gsuif.workspace.attempt.<pageId>` (the exact request JSON, never credentials). Recovery is "Retry with the same attempt ID" (exact original request) or an explicit "Start a new attempt".
- Run details, validation scope as reported, and registered files viewed as escaped text or downloaded, only for a committed `SUCCESS` package.

Pending backend contracts, isolated behind ports in `features/workspace/services/generation-ports.ts`:

- `CONTRACT_CATALOG`: a static list of the BACKEND-eligible (updateMode FULL) registry pairs at the PR head above, until the contract-listing API exists.
- `ATTEMPT_RECOVERY`: unavailable until the owner-scoped lookup by attemptId exists.
- `PACKAGE_DOWNLOAD`: unavailable until the direct package ZIP endpoint exists. Do not build the export-destination workflow in the UI.

Replace each default provider with an HTTP adapter only after its actual endpoint and DTO are verified on a backend revision.
