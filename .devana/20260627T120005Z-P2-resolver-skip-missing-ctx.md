DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | medium | security=no
DEVANA-KEY: src/index.ts:656-659,741-752 | resolver-skip-missing-ctx

# Resolver rules silently skip when ctx is omitted

## Finding

Direct calls to `resolveTakiContributions` with resolver rules but without `options.ctx` treat every resolver as unavailable, skip all `kind: "resolve"` rules, and emit no warning because `handleResolverError` logs through `options.ctx?.log.warn`.

## Violated Invariant Or Contract

When a resolver function is registered in `options.resolve` or `options.resolvers`, resolution should run or fail loudly. Silent omission with no log violates the public API expectation for programmatic resolution outside plugin hooks.

## Oracle

Plugin hooks always pass `ctx` from EmDash (`src/index.ts:190`, `196`). Tests that exercise resolvers supply `ctx` (`test/renderer-contract.test.mjs`). The error message says the resolver is "not registered" even when it exists but `ctx` is missing.

## Counterexample

```js
const result = await resolveTakiContributions(
  [resolve({ input: { source: "test" } })],
  page,
  {
    resolve: () => meta("description", "from resolver"),
  },
);

// result.metadata is [] and no warning is logged
```

## Why It Might Matter

Tooling, previews, or unit tests that call `resolveTakiContributions` directly and forget `ctx` get empty metadata with no diagnostic, while the resolver function is present and would work if `ctx` were supplied.

## Proof

**Control-flow trace:** `resolveRules` → `getResolver` succeeds → `!options.ctx` branch (`src/index.ts:656-659`) → `handleResolverError` (`src/index.ts:741-752`) → `options.ctx?.log.warn` is undefined → `continue` without collecting resolver output.

**Contract mismatch:** Missing resolver registration and missing `ctx` share the same code path and error text ("not registered") despite different root causes.

## Counterevidence Checked

- Production EmDash hooks always provide `ctx`, so the primary integration path is unaffected.
- Passing `ctx: { log: console }` restores the warning path for debugging.
- Static-only rules still resolve without `ctx`.

## Suggested Next Step

Distinguish missing `ctx` from missing resolver in the error message, and throw or `console.warn` when `ctx` is required but absent and resolver rules are present.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed the combined `!resolver || !options.ctx` branch labelled a present-but-ctx-less resolver as "not registered", and `handleResolverError` logged through `options.ctx?.log.warn`, which is undefined exactly when ctx is missing — so the diagnostic was silently dropped. Split the branch so a missing resolver and a missing ctx produce distinct error messages (the latter: 'requires a plugin "ctx" but none was provided'). Made `handleResolverError` fall back to `console.warn` when `options.ctx?.log?.warn` is unavailable so the warning is visible on direct `resolveTakiContributions` calls. `onError: "throw"` still throws (now with the ctx-specific message); the skip-and-continue default is preserved but now logs. Added regression tests "warns via console when a resolver rule runs without ctx" and "throws a ctx-specific error when a missing-ctx resolver opts into onError throw". typecheck clean, full suite green (28 tests).

DEVANA-KEY: src/index.ts:656-659,741-752 | resolver-skip-missing-ctx
DEVANA-SUMMARY: fixed | P2 | medium | Missing ctx now produces a distinct error message and a console.warn fallback instead of a silent "not registered" skip.