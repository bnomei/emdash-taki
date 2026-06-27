DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/index.ts:1336-1349 | Slug: pathprefix-missing-path

# pathPrefix matcher throws when page.path is absent

## Finding

A rule with `when: { pathPrefix: "..." }` causes `resolveTakiContributions` (and plugin hooks that call it) to throw a `TypeError` when the supplied page object has no `path` field. Other matchers such as `path` safely return non-match for missing values.

## Violated Invariant Or Contract

Page matchers must be total and non-throwing: a non-matching page should skip the rule, not crash resolution for unrelated rules on the same page.

## Oracle

`matchesOneOrMany` used for `path` equality returns `false` when `page.path` is `undefined`. `pathPrefix` should follow the same non-match semantics.

## Counterexample

```js
await resolveTakiContributions(
  [meta("robots", "noindex", { when: { pathPrefix: "/preview" } })],
  { kind: "page", pageType: "page" },
);
```

`matchesPrefix("/preview", undefined)` calls `undefined.startsWith("/preview")` and throws before any contributions are collected.

## Why It Might Matter

Any caller of `resolveTakiContributions` with a partial page stub, test fixture, or future page context missing `path` can crash head resolution entirely instead of skipping scoped rules.

## Proof

**Control-flow trace:** `collectMetadata` / `collectFragments` / `resolveRules` → `matchesPage` → `matchesSinglePage` → `matcher.pathPrefix !== undefined` → `matchesPrefix(matcher.pathPrefix, page.path)` → `path.startsWith(value)` with `path === undefined` → `TypeError`.

**Cross-entry mismatch:** `path` matcher at `src/index.ts:1335` uses `matchesOneOrMany` (safe for `undefined`); `pathPrefix` at `src/index.ts:1336-1337` does not guard `page.path`.

## Counterevidence Checked

- Tests and README examples always include `path` on page objects.
- EmDash `PublicPageContext` likely supplies `path` in normal Astro layouts, which limits production exposure.
- `page.content?.collection` is optional-chained elsewhere, indicating missing optional fields are expected at runtime.

## Suggested Next Step

Guard `matchesPrefix` (or the `pathPrefix` branch in `matchesSinglePage`) so missing or non-string `page.path` yields `false` instead of calling `startsWith`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed `matchesPrefix` called `path.startsWith(...)` with no guard, so a page stub lacking `path` threw a TypeError before any contributions were collected, while the sibling `path` matcher (`matchesOneOrMany`) tolerates undefined. `PublicPageContext.path` is typed `string`, but partial runtime stubs/fixtures can omit it. Widened the param to `string | undefined` and added a `typeof path !== "string"` guard returning false (non-match), matching the `path` matcher semantics. Added regression test "pathPrefix matcher skips rules instead of crashing when page.path is absent". Full suite green (20 tests).

DEVANA-KEY: src/index.ts:1336-1349 | P2 | pathprefix-missing-path
DEVANA-SUMMARY: Status=fixed | P2 high src/index.ts:1336-1349 - matchesPrefix now guards non-string page.path and returns non-match instead of throwing.