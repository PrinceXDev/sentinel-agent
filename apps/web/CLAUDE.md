@AGENTS.md

# apps/web — engineering conventions

This is the sentinel-agent operator console **and** the marketing/docs site
(`/`, `/product`, `/docs/*`), all in one Next.js 16 / React 19 app. These
conventions apply to every file under `apps/web/src`, existing or new. They
were established by bringing the whole app to one consistent standard — not
proposed once and left half-applied — so treat drift from them as a defect,
not a style preference.

## Stack

- **Next.js 16** (App Router, Turbopack). This major version has real
  breaking changes from older Next.js — see `AGENTS.md` (imported above) and
  `node_modules/next/dist/docs/` before assuming an API or convention from
  training data still holds.
- **React 19.** No `forwardRef` for simple prop-forwarding, no default-props
  boilerplate — `ref` is a normal prop now. Prefer the modern form.
- **TypeScript 5.7, strict.** `npm run typecheck` runs `tsc --noEmit` across
  the workspace with no relaxed flags. A change that needs `any` or a
  type-assertion to compile is a change that needs a better type, not a
  suppression.
- **Biome** for lint and format (`npm run check` / `npm run ci`). Formatting
  disagreements are not a matter of taste here — run the formatter, don't
  hand-wrap lines to match it.
- **Vitest** for tests, colocated as `*.test.ts(x)` next to the code they
  cover.

## Components and functions: arrow functions, always

Every exported component, hook, route handler, and free function in this
app — no exceptions — is an arrow function assigned to a `const`:

```tsx
// yes
export const IncidentBrief = ({ state, error }: IncidentBriefProps) => {
  ...
};

// no
export function IncidentBrief({ state, error }: IncidentBriefProps) {
  ...
}
```

This includes:

- Page and layout components. Next.js requires a **default export**, not a
  particular function form — `const Page = () => {...}; export default Page;`
  satisfies the App Router exactly as well as `export default function Page()`
  does, and keeps the file consistent with everything else in it.
- Route handlers: `export const GET = async (req, ctx) => {...}` in place of
  `export async function GET(...)`. Same runtime behaviour, same convention.
- Small local helpers inside a component or hook (a nested `update()` in a
  `useEffect`, a one-off formatter) — convert those too. A file that is arrow
  functions everywhere except one helper reads as an oversight, not a choice.

**The one exception:** a string constant that exists specifically to *quote
verbatim third-party source* — e.g. `constants/codeSnippets.ts`'s excerpt of
TrueForge's actual `toolSelectors.ts` — keeps whatever style that source
actually uses. That string is documentation of someone else's code, not ours;
rewriting its contents to match our style would misrepresent what the
external file says. If you are ever touching a string like that, check
whether it is quoting a real file before "fixing" its style.

## Constants: nothing inline, everything named and located

No literal array, object, or multi-line template string lives inline inside
a component or page body. It gets a name and a home in
[`src/constants/`](src/constants), split by domain:

- **Cross-page/shared values** — e.g. `constants/site.ts` (repo URL, nav
  links, footer columns).
- **One file per non-trivial component's data** — e.g. `constants/tools.ts`
  for the MCP tool table, `constants/gateProbes.ts` for the Gate Prover
  cards, `constants/systemMap.ts` / `constants/annotationGate.ts` for the SVG
  diagrams' box/edge/lane data.
- **`constants/codeSnippets.ts`** for every verbatim code/diff/JSON excerpt
  quoted across the docs pages (keeps prose pages down to prose, and keeps
  every quoted excerpt in one place to check against its source).
- **`.tsx` instead of `.ts`** when the constant needs JSX (e.g.
  `constants/productFeatures.tsx`, whose `panel` field renders a component).

A page or component file should read as markup driving imported data, not
data mixed into markup. If a value is derived from another constant (a
count, a filtered list), compute it in the constants file next to the data
it depends on — not back in the component.

Small, purely-local layout scalars that aren't arrays or objects — an SVG
`viewBox` width, a pixel padding number used nowhere else — can stay next to
the component that draws with them. The bar is "array, object, or reusable
string," not "every number."

## Comments: short, and only for the non-obvious

Match the rest of the codebase: no comment restates what the code already
says. A comment earns its place by explaining a constraint, a tradeoff, or a
"why" that isn't visible from reading the lines below it — a workaround for a
specific bug, a reason a naive approach was rejected, a note that a value is
intentionally duplicated rather than shared. One or two sentences. If you
can delete a comment without losing information, delete it.

## Enterprise-level bar: what "done" means here

Before treating a change as finished:

- `npm run ci` passes — Biome, `tsc --noEmit`, and the full test suite,
  clean. Not "typecheck passes, tests I remembered to run pass" — the actual
  command.
- New behaviour has a test, or a one-line note on why it doesn't (a pure
  visual change with no logic to assert on, for instance).
- If the change is visible in a browser, it was actually opened in one —
  console checked for errors, the specific interaction exercised, not just
  "the build succeeded." See `apps/web/AGENTS.md` for why: breaking changes
  between Next.js versions are exactly the kind of thing that compiles fine
  and fails at runtime.
- A mechanical, repo-wide change (a rename, a style conversion, a refactor
  touching many files) gets verified with a real command afterward — `grep`
  for the old pattern to confirm zero remain, not an assumption that the tool
  that did the rewrite got every file.
- Anything that turns out to be quoting real external source, a security
  boundary, or a documented tradeoff gets called out rather than silently
  "fixed" to match house style. Consistency is the default; correctness about
  what a thing actually is comes first.
