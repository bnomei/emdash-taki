DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:662-676,721-728,1233-1235 | resolver-null-entry-total-loss

# Null entries in resolver return arrays drop all resolver output on ignore

## Finding

When a resolver returns an array containing `null` (or any value that makes `isStaticRule` throw), `normalizeResolverResult` throws while filtering. `resolveRules` catches the error and applies `onError: "ignore"` by logging and skipping the rule. Valid sibling entries in the same resolver return are discarded.

## Violated Invariant Or Contract

Resolvers may return arrays of rules. A single bad entry should not silently discard valid co-returned rules when `onError` is `ignore`. Partial success is the implied contract for ignore mode.

## Oracle

`src/index.ts:721-728` (`result.filter(isStaticRule)`); `src/index.ts:1233-1235` (`isStaticRule` calls `rule.kind` on each element); `src/index.ts:674-676` (catch routes to `handleResolverError`).

## Counterexample

```js
const result = await resolveTakiContributions(
  [resolve({ onError: "ignore" })],
  page,
  {
    ctx: { log: { warn() {} } },
    resolve: () => [meta("a", "1"), null, meta("b", "2")],
  },
);
// result.metadata === []
// warn: Taki resolver "default" failed
```

## Why It Might Matter

Template handlers assembling rules from multiple sources can accidentally include a null slot (for example `array.filter(Boolean)` missed, or spread of optional entries). All successful metadata/fragments from that resolver are lost with only a generic warn.

## Proof

**Control-flow trace:** resolver returns `[meta, null, meta]` → `normalizeResolverResult` → `filter(isStaticRule)` throws on `null` → catch → `handleResolverError` → continue without pushing any normalized rules.

## Counterevidence Checked

Well-typed resolvers returning only rule objects do not hit this path. `return null` for the whole result is handled safely (`if (!result) return { rules: [] }`). Deliberate `onError: "throw"` correctly propagates.

## Suggested Next Step

Filter null/non-object entries before `isStaticRule`, or isolate per-entry validation so one bad entry does not void the entire resolver return.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Confirmed empty metadata and warn when middle array entry is null.

DEVANA-KEY: src/index.ts:662-676,721-728,1233-1235 | resolver-null-entry-total-loss
DEVANA-SUMMARY: open | P2 | high | A null entry in a resolver return array triggers normalizeResolverResult failure and onError ignore drops every rule from that resolver.