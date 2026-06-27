DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | medium | security=no
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

DEVANA-KEY: src/index.ts:656-659,741-752 | resolver-skip-missing-ctx
DEVANA-SUMMARY: open | P2 | medium | resolveTakiContributions drops resolver rules without ctx and logs nothing because warn uses options.ctx.