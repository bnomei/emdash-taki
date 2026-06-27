DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | medium | security=no
DEVANA-KEY: src/index.ts:639-680,721-738,1233-1235 | nested-resolve-rules-dropped

# Nested resolve rules returned from resolvers are silently discarded

## Finding

`resolveRules` performs a single pass over top-level rules. When a resolver returns a `kind: "resolve"` rule, `normalizeResolverResult` filters it out via `isStaticRule`. Nested resolvers never run. No warning is logged.

## Violated Invariant Or Contract

Resolvers return rule arrays that callers may compose from helper outputs, including nested `resolve()` rules for staged resolution. Discarding nested resolve rules without error changes semantics silently.

## Oracle

README L288-289 (resolvers return rule arrays); `src/index.ts:721-738` (`.filter(isStaticRule)`); `src/index.ts:1233-1235` (`isStaticRule` excludes `kind: "resolve"`); `src/index.ts:639-680` (single-pass `resolveRules`).

## Counterexample

```js
const result = await resolveTakiContributions(
  [resolve()],
  page,
  {
    ctx: { log: { warn() {} } },
    resolve: () => [
      meta("outer", "kept"),
      { kind: "resolve", resolver: "default", input: { nested: true } },
    ],
  },
);
// result.metadata: [{ name: "outer", content: "kept" }]
// nested resolve never executes
```

## Why It Might Matter

Composable template utilities that return `[...baseRules, resolve({ input })]` from inside another resolver will drop the inner resolve without notice, breaking dynamic overrides.

## Proof

**Control-flow trace:** outer resolver returns nested `resolve` rule → `normalizeResolverResult` filters → only static rules collected → no second `resolveRules` pass.

## Counterevidence Checked

Top-level `resolve()` rules in `astro.config` rules work. README examples show flat static rule returns, not nested resolve, but does not forbid nesting. `onError` is irrelevant because no error is raised.

## Suggested Next Step

Either recursively resolve nested `kind: "resolve"` entries in `normalizeResolverResult`, or throw/warn when a resolver returns nested resolve rules.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Confirmed nested resolve stripped with only outer metadata kept.
- 2026-06-27: fixed (surfaced the silent drop; did not add nested-resolution as a feature). Confirmed `resolveRules` is a single pass and `normalizeResolverResult` filtered resolver-returned `kind:"resolve"` rules out via `isStaticRule`, so nested resolvers never ran and nothing was logged. The reported defect is the SILENCE ("changes semantics silently"); recursive nested resolution was rejected as out of scope for a bug fix — it needs cycle/depth limits, assetMap merge-order rules, and per-nested onError semantics, and the README documents flat returns. Fix: `normalizeResolverResult` now reports `nestedResolverCount` (resolve rules encountered), and `resolveRules` warns (`Taki resolver "X" returned N nested resolve rule(s); nested resolvers are not executed and were ignored.`) when any are dropped, while still keeping the valid sibling rules. The single-pass loop also folds in the [[resolver-null-entry-total-loss]] null guard. Added regression test "warns and keeps siblings when a resolver returns a nested resolve rule" (outer metadata kept; one warning emitted). typecheck clean, full suite green (45 tests).

DEVANA-KEY: src/index.ts:639-680,721-738,1233-1235 | nested-resolve-rules-dropped
DEVANA-SUMMARY: fixed | P2 | medium | Resolver-returned nested resolve rules are still not executed (by design) but now warn instead of being dropped silently; valid siblings are kept.