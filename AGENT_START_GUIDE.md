# GSUIF Frontend — Agent Start Guide

How to run the implementation with an AI agent, step by step: what to open, what to check, and what to paste.

This guide does not change any requirement. `IMPLEMENTATION_PLAN.md` is the source of truth. If this guide and the plan ever disagree, the plan wins.

Roles in this run: Cursor orchestrates. Codex Builder (Model A) implements and fixes. Codex Reviewer (Model B) performs an independent read-only review. Cursor performs the second, final read-only review. You perform the final review and every Git and GitHub operation.

Scope of the whole run: SCRUM-68, then SCRUM-69, then SCRUM-70, then SCRUM-71. Nothing else.

---

## 0. Before you open anything: what you need

| Thing | Why | How you know it is ready |
|---|---|---|
| Docker Desktop running | The backend database runs in it | Docker Desktop shows "Engine running" |
| Backend repository on disk | You start the backend locally | You can open `gsuif-backend` |
| Java 21 | Backend requires it | `java -version` prints 21 |
| Node.js | Angular CLI needs it | `node -v` prints a version |
| Frontend workspace | Where the agent writes code | `G:\CSAI-801\graduation project\gsuif-Frontend` opens in Cursor |
| A backend user you created yourself | Login cannot be proven without one | You can sign in through Swagger |

You do not need the Angular CLI installed globally in advance. The agent detects the installed CLI and Node versions, proposes one compatible Angular version when the project is still empty, and waits for your approval, as described in plan section M.

No local clone of `gsuif-backend` was found next to this frontend workspace when this guide was written. Fill in the real path yourself in step 1. Do not let the agent guess a path.

---

## 1. Open the backend database

Open a terminal in the backend repository folder and start Postgres.

```powershell
cd "<PASTE YOUR LOCAL PATH TO gsuif-backend>"
docker compose up -d
docker ps
```

`docker ps` must show a `postgres:16` container. If it does not, the frontend cannot load any data later.

The backend repository at commit `99c90935279fd44dac6ab0969139a7d4b65384f8` contains `docker-compose.yml`. That is the file this command uses.

---

## 2. Open and start the backend

In the same backend folder:

```powershell
git fetch
git checkout develop
git log -1 --format=%H
```

Write down the commit hash that prints.

- If it is `99c90935279fd44dac6ab0969139a7d4b65384f8`, the plan's backend contract is still exact.
- If it is a different hash, do not change the plan yourself. Tell the agent the new hash in step 6. Plan section A requires the agent to stop and re-read the controllers, DTOs, and `SecurityConfig` named in plan section B before coding.

Start the backend. On Windows PowerShell use the `.cmd` wrapper. That file exists at the baseline commit next to `mvnw`.

```powershell
.\mvnw.cmd spring-boot:run
```

Leave this terminal running. It must stay up for SCRUM-69, 70, and 71.

Confirm it is alive. Open in a browser:

```text
http://localhost:8080/swagger-ui.html
```

---

## 3. Create your local login user

This is a HUMAN-ONLY step. Do it once, yourself. Never ask the agent to invent, store, or commit credentials. The agent must never create or modify backend code, SQL, or a helper to do this.

The backend has no registration endpoint and `sql/V1__init_schema.sql` seeds no users, so a row must exist in `gsuif_user` before any login can succeed, with a password hash the backend can verify. Plan section F says a person creates that user. The plan does not document the password-hashing algorithm. Do not guess one, and do not let the agent guess one.

How you create the row is your choice, using a mechanism you already have: direct SQL into the running Postgres container, or a helper that already exists on your machine. Do not add a new backend implementation for it.

Rules that are not negotiable:

- The password never appears in the frontend repository.
- The password never appears in a chat message to the agent.
- The password never appears in a committed file, fixture, test, log, or screenshot.

Verify the user works before involving the agent at all:

1. Open `http://localhost:8080/swagger-ui.html`.
2. Find `POST /api/auth/login` under the auth group.
3. Execute it with your username and password.
4. You must get HTTP 200 with `clientMessage` "Authentication successful" and a `body` containing `token`, `tokenType`, `username`, and `roles`.

If that call fails, stop here. The frontend cannot be verified until it succeeds, and the agent cannot fix it from the frontend repository.

---

## 4. Make the credentials available to tests without writing them down

Playwright must read the password from the environment at run time, as required by plan sections X and Y.

You set the variables yourself, in the terminal session that will later run the tests. You never paste the password into the agent chat. The agent only checks that the names are present in its test process. If they are missing, the agent must stop. It must not ask you to type the password into chat.

```powershell
$env:GSUIF_E2E_USERNAME = "<your local username>"
$env:GSUIF_E2E_PASSWORD = "<your local password>"
```

These two variable names are a convention of this guide, not a backend requirement. Tell the agent to use exactly these names so it does not invent its own.

Do not put these lines in a `.ps1` file inside the repository. Do not add them to a `.env` file. Set them by hand in the session that runs the tests.

---

## 5. Open the frontend workspace and the agent

1. Open Cursor on `G:\CSAI-801\graduation project\gsuif-Frontend`.
2. Open a new agent chat in Agent mode, not Ask mode. This Cursor agent is the orchestrator. It does not implement the ticket itself: it delegates the implementation to Codex Builder (Model A), runs the checks, and takes part in the reviews. The files are created by Codex Builder.
3. Open these two files as tabs so they are attached context:
   - `IMPLEMENTATION_PLAN.md`
   - `AGENT_START_GUIDE.md`
4. Open an integrated terminal in the same workspace. The agent will run `npm` and `ng` here.

Keep the backend terminal from step 2 separate. Do not stop it to run frontend commands.

Before each ticket, YOU create that ticket's feature branch from the current `develop`, using the names in plan section Z (for example `feature/SCRUM-68-angular-skeleton`). Branch creation is a Git write and is never done by an agent.

Skills and tools: see plan section U. They never override the plan, and a missing skill does not block a ticket.

---

## 6. First message to the agent

Paste this. Replace the hash only if step 2 printed a different one. Replace the backend path with the folder you used in step 1.

```text
You are implementing the GSUIF frontend.

IMPLEMENTATION_PLAN.md in this workspace is your source of truth. Read it fully before you write any code. Do not re-run discovery. Do not invent endpoints, fields, routes, colors, or dependencies.

Environment facts for this session:
- Backend repository path: <PASTE YOUR LOCAL PATH TO gsuif-backend>
- Backend is running at http://localhost:8080 with the local profile.
- Backend develop HEAD is <PASTE HASH FROM STEP 2>.
- A login user exists in the local database. I will never paste its password. Playwright must read GSUIF_E2E_USERNAME and GSUIF_E2E_PASSWORD from the environment. If either variable is missing from your test process, stop. Do not ask me to paste the password.

Before doing any work, run and report `git branch` and `git status` (read-only). If the current branch is main, develop, master, or any other base branch, stop. The current ticket is worked on only from its human-created feature branch. You are the orchestrator: delegate the implementation to Codex Builder (Model A). You never run Git writes.

First task, before any code:
1. Confirm the plan's backend baseline commit matches the HEAD I gave you. If it does not match, re-read the backend controllers, DTOs, and SecurityConfig named in plan section B, using the backend path above, then report any contract difference and stop.
2. Detect and report the installed Node.js version.
3. Detect and report the installed Angular CLI version, if one exists.
4. If package.json already exists in this workspace, read the configured Angular version and use that version. Do not propose a different one.
5. If the project is still empty, propose exactly one Angular version that satisfies Angular 17+ and is compatible with the detected Node.js version. Explain that compatibility. Do not pick the newest release just because it exists. If more than one compatible version is available, stop and ask me which one to pin.
6. Record the exact Angular version and the exact Node.js version in your report before any scaffolding or coding.

Then stop and wait for my approval. Do not run ng new yet. Do not commit anything.
```

Why the stop: plan section M leaves the exact Angular version to the moment of scaffolding, and forbids switching it later.

Read its answer and approve or correct the version. Then continue.

---

## 6A. Rules that apply to every ticket below

Paste this block at the start of each ticket prompt, or tell the agent once that it stays in force for SCRUM-68 through SCRUM-71. These rules are already in the plan. This section only collects them so a later prompt cannot drop them.

```text
Rules in force for every ticket. IMPLEMENTATION_PLAN.md wins if anything here is unclear.

Do not introduce Angular Material, PrimeNG, Bootstrap, Tailwind, another UI framework, another CSS or design system, another icon system, or a downloaded web font.
Do not add an npm dependency unless this plan already requires it, and record any dependency and the reason in the task report. Packages created by the approved Angular CLI scaffold are part of that scaffold, not an extra dependency.
Playwright is the one exception: plan section X requires browser verification against the real backend. Add it only as a devDependency, record it in the task report, and do not use it to mock /api.

Never fabricate project, page, or metadata data when a request fails, and never add sample records so a screen looks complete.

After each ticket, in this order: build or ng serve compile, typecheck, lint if a lint target exists, the unit tests that ticket owns in plan section V, Playwright only for the scenarios in plan section X that this ticket can actually run, then the review in section 12 of AGENT_START_GUIDE.md. Update the matching lines in plan section AD only after that evidence exists. An unchecked line is not done.

Never edit the backend repository. Never edit IMPLEMENTATION_PLAN.md.

Agents never perform Git writes, GitHub writes, remote changes, pull request operations, merge operations, or Jira changes. This includes git add, git commit, git push, branch creation or deletion, and creating a GitHub repository. The human performs them. Agents may only run read-only Git inspection: git status, git diff, git log, git show, git branch (listing), git remote -v.

Cursor orchestrates and delegates implementation and fixes to Codex Builder. The hard rules in each ticket prompt below are passed to Codex Builder unchanged.
```

---

## 7. SCRUM-68 — skeleton, shell, design tokens

Paste section 6A, then:

```text
Implement SCRUM-68 exactly as specified in IMPLEMENTATION_PLAN.md section M, with the architecture in section G, the tokens in section Q, the motion in section S, and the shared components in section T.

Hard rules for this task:
- Keep src/app/app-routing.module.ts. Do not produce a standalone-only project that omits it. Declare components in the feature modules.
- Create the STD-07 folders exactly as mapped in section G: core/guards, core/interceptors, core/services, core/models, shared, features.
- Create proxy.conf.json for /api to http://localhost:8080 and wire it into angular.json serve.
- Put every color, font, radius, and spacing value in src/styles/tokens.css. No hex values anywhere else.
- Create NotificationService and LoadingService. Do not create the SCRUM-72 LoadingInterceptor.
- No login form, no metadata table, no generation UI, no fake data, no charts.
- Dependencies: follow section 6A. Do not add a package beyond what the CLI generates for this ticket.

When done: run ng serve, confirm it compiles, and report the exact Angular version, the exact Node version, the file tree you created, and anything in the plan you could not satisfy. Then run the section 6A verification for this ticket. Playwright scenarios in plan section X start at SCRUM-69, so record that browser verification is not applicable yet. Do not commit.
```

What you check yourself afterwards:

- `src/app/app-routing.module.ts` exists.
- `src/app/core/guards`, `core/interceptors`, `core/services`, `core/models`, `shared`, `features` all exist.
- `proxy.conf.json` targets only `http://localhost:8080`.
- `ng serve` opens a page that shows the shell and the text "Frontend skeleton." The Angular CLI default port is 4200 unless `angular.json` sets another. Use the port the serve output prints.
- `package.json` has no UI framework in it.

If any of those is wrong, say which one and let the agent fix it. Do not move to SCRUM-69 with a broken skeleton.

---

## 8. SCRUM-69 — login, guard, interceptors

Paste section 6A, then:

```text
Implement SCRUM-69 exactly as specified in IMPLEMENTATION_PLAN.md section N, following the authentication contract in section F and the service design in section I.

Hard rules for this task:
- ApiClientService returns ApiResponse<T> and does not unwrap it. AuthService unwraps body.
- Store the session only in sessionStorage under the single key gsuif.auth. No localStorage. No other authentication keys such as token, jwt, authToken, user, or roles.
- AuthService is the only reader, writer, and remover of gsuif.auth. The guard, interceptors, and components call AuthService.
- AuthInterceptor sends Authorization: Bearer <stored JWT>. Never log the password, the JWT, or the Authorization header.
- A 401 from POST /api/auth/login stays on /login, shows the backend clientMessage once, and does not clear or redirect. ErrorInterceptor must not handle that case. AuthService.login does not notify and does not navigate on failure. LoginComponent notifies once.
- A login HTTP 400 stays on /login and shows field messages from the backend errors map on the matching controls, plus clientMessage in the notification.
- A 401 from any other request clears the session once through AuthService.clearSession and redirects to /login once. Do not also call logout for that case.
- There is no logout API. logout() only clears gsuif.auth and navigates to /login.
- There is no refresh endpoint and no refresh timer.
- Successful login always goes to /home. Do not add returnUrl.
- Add the AuthService, AuthInterceptor, ErrorInterceptor, and login envelope unit tests listed in plan section V.

When done: report the files and the test results. Search the whole frontend workspace, including untracked files, and confirm no password, JWT, or Authorization header value appears. Do not commit.
```

What you check yourself:

- Wrong password: stays on `/login`, shows "Invalid username or password", and DevTools Application shows no `gsuif.auth`.
- Correct password: lands on `/home`, and `sessionStorage` contains `gsuif.auth` and no other authentication key.
- Reload on `/home`: still signed in.
- Logout: back on `/login`, key gone.
- Typing `/home` in the URL while signed out: redirected to `/login`, and the next successful login still opens `/home`.
- Search the workspace, not only `git diff`, for your password. It must not appear.

---

## 9. SCRUM-70 — home

Paste section 6A, then:

```text
Implement SCRUM-70 exactly as specified in IMPLEMENTATION_PLAN.md section O.

Hard rules: /home is AuthGuard protected. The welcome line uses AuthService.getUsername() per section O: "Welcome, {username}." when the username is non-empty, otherwise "Welcome." One control, "Browse metadata", routing to /projects. No statistics, counters, charts, recent activity, or sample data of any kind. No new API call and no new backend endpoint.

Then run the section 6A verification for this ticket. Report the files and confirm no invented dashboard data exists. Do not commit.
```

What you check yourself: the welcome line shows your real username, and the single control opens `/projects`, which can legitimately be empty at this point.

---

## 10. SCRUM-71 — metadata browser

Before you paste, make sure the database actually has something to show. This is a HUMAN-ONLY data step. Do not ask the agent to add seed logic, a write call, or a backend change.

Through Swagger, create at least one project, one page in it, and one metadata version for that page. Plan section E requires the metadata body to contain only `schemaVersion` and `snapshot`, with `schemaVersion` exactly `1.0.0`. Extra JSON properties are rejected. Do not invent additional metadata fields.

Paste section 6A, then:

```text
Implement SCRUM-71 exactly as specified in IMPLEMENTATION_PLAN.md section P, using only the GET endpoints in section E, the models in section J, and the pagination contract in section K.

Hard rules for this task:
- Read-only. No create, update, delete, compare, export, or generation control. Do not add application-code seed logic.
- ProjectService, PageService, and MetadataService call ApiClientService and unwrap body. No component imports ApiResponse.
- Every list request sends size=20, a zero-based page, and the default sort for that resource: createdAt,desc for projects and pages, version,desc for metadata. Do not add search, filters, or a page-size control.
- Project detail loads the project and its pages as two independent regions with independent loading and error states. If the pages request fails, keep a successfully loaded project visible. If the project request fails, do not pretend the project exists. Never fabricate rows when a request fails.
- After a successful version list, select the first returned row and show its snapshot. If the list is empty, select nothing and show the empty state. Do not fabricate a snapshot.
- The list response already includes snapshot. Do not add service methods, and do not call, these routes: /metadata/current, /metadata/latest, /metadata/{versionId}.
- isCurrent true shows the text "Current". isCurrent false shows no Current badge. Never show "Latest", "Most Recent", or "Newest".
- DataTable is one reusable component with a desktop table view and a mobile stacked view. Do not create two table components and do not duplicate row logic per screen.
- Add the envelope and pagination unit tests listed in plan section V.

Then run the section 6A verification for this ticket. Report the files, the test results, and the exact request URLs you observed. Do not commit.
```

What you check yourself:

- `/projects` shows your real project name.
- A row opens `/projects/{id}` and the page table loads underneath the project fields.
- A page row opens the versions screen, the first version is already selected, and its snapshot JSON is visible.
- A version with `isCurrent` true shows "Current". Nothing says "Latest".
- A page with no `route` shows a blank cell, not the word "null".
- The network panel shows `page=0` and `size=20`, and `page=1` after Next when there is more than one page.

---

## 11. Browser verification

The variables from step 4 must already be set in the terminal the agent will use. Paste this into the agent chat, not the password.

```text
Run the Playwright verification in IMPLEMENTATION_PLAN.md section X against the running backend through the Angular dev proxy.

Before you start, confirm GSUIF_E2E_USERNAME and GSUIF_E2E_PASSWORD are present in the process that will run the tests. If either is missing, stop. Do not ask me to paste the password.

Hard rules:
- Never intercept or mock /api. If a scenario cannot run honestly, record it as skipped with the reason.
- Never print the password, the JWT, or the Authorization header.
- Assert the real request URLs and the real page query values, not only visible text.
- Capture console messages and fail on unexpected console errors, page errors, and unhandled exceptions. List any message you decided to ignore and why. Do not ignore all console errors.
- Do not delete project, page, or metadata data to force an empty state. If the local data is not empty, record that empty-state case as not executed and say why.
- The protected-API 401 scenario must be skipped while the backend security mode is dev. Do not fake it.

Report pass, fail, and skip per scenario.
```

Expect at least one legitimate skip: the non-login 401, because the local profile runs `gsuif.security.mode=dev`, where every request is permitted. That skip is correct behavior, not a gap in the frontend. An empty database is not required. If your data is not empty, the empty-state scenario is recorded as not executed.

---

## 12. Independent review

The builder never grades itself. The review flow, after the ticket's build, typecheck, lint, unit tests, and Playwright checks have run:

1. Codex Reviewer (Model B) performs an independent, read-only review.
2. Cursor performs a second, read-only review.
3. If valid findings exist, Codex Builder fixes them.
4. Re-run the required failed checks.
5. Maximum 3 fix rounds per ticket.
6. If valid issues remain after the third round, stop and ask the human.

Use this prompt for both reviewers. It uses the criteria of plan section W:

```text
Review the full diff of this ticket against IMPLEMENTATION_PLAN.md sections E, F, G, H, I, J, K, Q, S, W, Y, and AA. Report findings by severity using the section W rules. Cover the backend contract, authentication, architecture, security, non-goals, dependency rules, tokens, motion, unit tests, and Playwright behavior. You are read-only: do not fix anything and do not run any Git write command. List only real violations of the plan, not stylistic preferences.
```

Then, only if valid findings exist, send this to Codex Builder:

```text
Fix valid findings, blocking first, then important, then minor. Do not ignore a valid minor finding. Maximum three fix rounds per ticket. If valid findings remain after the third round, stop and ask the human instead of trying again. Do not delete a failing test to make the suite pass. Do not run any Git write command.
```

---

## 13. Saving your work

No agent commits, ever, even if you approved a checkpoint earlier. You perform every Git write. After all checks and both reviews pass and you have done your own review, ask for the handoff:

```text
Show me git branch, git status including untracked files, and git diff --stat (read-only). Then give me the exact commands for git add, git commit, git push, pull request creation, and merge, using the commit format [SCRUM-XX] Short description. Do not run any of them.
```

You then run those commands yourself:

- git add
- git commit
- git push
- pull request creation
- merge

The next ticket starts only after you have merged the previous ticket and updated the local `develop`. Then you create the next ticket's feature branch.

This frontend workspace has no `.gitignore` yet. After Angular scaffolding, inspect the generated `.gitignore` and `git status`. The first local commit, which you make, must not contain `node_modules`, `dist`, `.angular`, environment files, Playwright traces, secrets, or credentials, whether or not a generated ignore file already excludes them. Plan section Z requires that exclusion. Do not assume an ignore file exists before the project is generated.

Pushing, creating a remote branch, adding a Git remote, and opening or merging a pull request are done by you, never by an agent. Before the handoff, the agent reports (read-only):

- current branch
- remote
- files changed
- commits
- author identity
- GitHub account, only if it can be read without exposing a credential or token
- the exact commands for you to run

That report is plan section Z. No push happens because the report was written.

---

## 14. Daily restart, once the project exists

```powershell
# terminal 1, backend folder — use the path from step 1
docker compose up -d
.\mvnw.cmd spring-boot:run

# terminal 2, frontend folder
ng serve
```

Then open the URL printed by `ng serve`. The Angular CLI default port is 4200 unless `angular.json` sets another port. 4200 is not a backend contract and is not defined in the plan.

To resume the agent after a break or a model change:

```text
Continue the GSUIF frontend implementation from IMPLEMENTATION_PLAN.md. Do not restart discovery and do not redo work that is actually complete.

Before you continue:
- Run git branch, git status (including untracked files), and git log, all read-only. State which ticket feature branch you are currently on. If you are on main, develop, master, or another base branch, stop.
- Inspect the workspace files, not only the section AD checkboxes.
- Compare what exists with the current ticket section.
- Say which checklist lines are true because the files and checks exist, and which are still open.
- Continue from the first unfinished ticket.
- Do not overwrite or discard existing local work.
```

---

## 15. When something looks wrong

| Symptom | Most likely cause | What to do |
|---|---|---|
| Lists are empty but login works | The database has no projects yet | Create data through Swagger. Do not let the agent add sample data |
| Login returns 401 with a password you believe is right | The stored hash does not match, or the user row is missing | Re-test `POST /api/auth/login` in Swagger. The frontend is not the problem |
| Browser shows a CORS error | `/api` is being called on port 8080 directly instead of through the proxy | The fix is `proxy.conf.json` and relative `/api` URLs. Never add CORS to the backend |
| `/projects` shows an error immediately | Backend is not running, or the proxy target is wrong | Check the backend terminal and `proxy.conf.json` |
| The agent proposes Angular Material, Tailwind, PrimeNG, Bootstrap, or a chart library | It is drifting from plan sections G and Q | Refuse. The tokens in section Q plus the components in section T are the whole visual system |
| The agent wants to call a generation endpoint, `/metadata/current`, `/metadata/latest`, or `/metadata/{versionId}` | Those calls are outside this frontend scope | Refuse. Plan section I forbids `latest` and `current` methods here. Plan section E says the list already includes `snapshot`. Plan section AA forbids `/metadata/current` and generation |
| The agent wants to mock `/api` to make a test pass | It is hiding an integration problem | Refuse. Plan section X forbids it |

---

## 16. Hard stops: tell the agent no

Reserved for the human. An agent never performs these, with or without approval:

- Git writes: git add, git commit, git push
- Creating or deleting a branch
- Creating a GitHub repository, or changing GitHub repository settings
- Adding or changing a Git remote
- Creating or merging a pull request
- Changing Jira

Stop and wait for your explicit approval before any of these:

- Editing the backend repository
- Editing `IMPLEMENTATION_PLAN.md`
- Changing the section E backend contract
- Changing the section Q design tokens
- Changing the section S motion rules
- Deploying

Also refuse, with no approval path inside this scope:

- Any new backend endpoint, field, or DTO that is not in plan section E
- Any write operation in the UI: create, update, delete
- Any call to `/metadata/current`, `/metadata/latest`, or `/metadata/{versionId}`
- Any generation, export, artifact, or build-validation screen
- Any second design system, icon pack, or downloaded font
- Any credential, token, or secret in a file, a log, a screenshot, or a test fixture
