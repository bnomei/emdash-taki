DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | high | security=no
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
- 2026-06-27: fixed. Confirmed `isStaticRule` did `!isResolverRule(rule)` → `rule.kind === "resolve"`, which throws on a `null` (or non-object) array entry; `normalizeResolverResult`'s `filter(isStaticRule)` therefore threw, the catch routed to `handleResolverError`, and onError "ignore" dropped the entire resolver return (valid siblings included). Fix: make `isStaticRule` null/non-object-safe with `isRecord(rule) && !isResolverRule(rule)`, so a stray `null` is filtered out and valid co-returned rules survive — partial success as the ignore-mode contract implies. `isStaticRule` is only used by the two `normalizeResolverResult` filters, so the change is self-contained. A non-object entry is dropped silently (like a missed `filter(Boolean)`), which is the intended outcome. Added regression test "keeps valid resolver rules when the return array contains a null entry" (asserts both meta a and b survive through resolvePageMetadata). typecheck clean, full suite green (42 tests).

DEVANA-KEY: src/index.ts:662-676,721-728,1233-1235 | resolver-null-entry-total-loss
DEVANA-SUMMARY: fixed | P2 | high | isStaticRule is now null/non-object-safe, so a null entry in a resolver return array is filtered out instead of throwing and discarding all co-returned rules.