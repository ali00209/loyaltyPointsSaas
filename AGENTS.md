# AGENTS.md

Project-specific guidance for AI coding agents.

<!-- ASTRYX:START -->

Astryx v0.3.0 · 155 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:

1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:

- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
search "<query>" find any component / hook / doc / template / block
component --list 155 components by category
template --list page + block recipes
docs <topic> color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
swizzle <Name> eject component source for deep customization
upgrade --apply run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

TESTS (vitest — `npm test`):

- API tests live in `src/app/api/__tests__/` and run against a **real** Postgres: `src/test/global-setup.ts` drops/creates the `loyalty_test` DB and replays `drizzle/*.sql` before the first test, so `POSTGRES_*` from `.env` must be valid and Postgres must be running.
- `vitest.config.mts` points workers at `POSTGRES_DB=loyalty_test` and sets `fileParallelism: false` — every test file shares one database and truncates it per test.
- Call route handlers directly (import `GET`/`POST` from `route.ts`; pass `{ params }` for dynamic segments via `routeParams()`). Mock the request scope in each test file with `vi.mock("next/headers", () => import("@/test/next-headers"));` — everything else (guards, drizzle, bcrypt, JWT) runs for real.
- `src/test/helpers.ts`: `resetTestState()` in `beforeEach`, seeders (`seedTenant/seedOwner/seedAdmin/seedCustomer/seedApiKey`), sessions (`signInOwner/signInCustomer/openPortalSession/useBearer`), requests (`apiRequest/rawRequest/routeParams/jsonBody`). Seed users with `hashTestPassword()` — production `hashPassword()` costs ~0.6s per hash.

Keep things simple and stupid:

    Does this need to exist? -> no: skip it (YAGNI)
    Stdlib does it? -> use it
    Native platform feature? -> use it
    Installed dependency? -> use it
    One line? -> one line
    Only then: the minimum that works

Avoid writing tests unless requested
Avoid OOP, particularly inherentance unless absolutely necessary.
Avoid trivial functions and abstractions.
Focus on your task. You are not allowed to revert changes made by others unless explicitly requested.
Never revert changes made by other agents.
A clear crash is always preferable to an unclean state
Use builder pattern where it fits. Avoid crazy long function arguments.
Never implement placeholder of any kind. It either works or it just fails entirely.
