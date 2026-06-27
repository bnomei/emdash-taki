DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:460-472,813-816 | renderTakiStart-strip-before-render

# renderTakiStart removes early fragments before render succeeds

## Finding

`renderTakiStart` calls `removeEarlyTakiFragments(fragments)` on the shared EmDash cached array before `renderFragments` returns. If rendering throws, early fragments are already spliced out of the cache with no rollback. Later `EmDashHead` or `renderTaki` calls in the same request see a cache missing those early resources.

## Violated Invariant Or Contract

Early fragments should be removed from the shared cache only after they are successfully rendered, or the mutation should be reversible. The README pairing with `EmDashHead` assumes strip prevents duplication, not that strip can occur without a successful render.

## Oracle

`src/index.ts:469-472` (strip then render order); `test/renderer-contract.test.mjs` L128-148 (mutates shared `fragments` array); EmDash `pageContributionCache` returns the same array reference on subsequent collects.

## Counterexample

1. `collectPageFragments(page)` populates cache with early + late fragments.
2. `renderTakiStart` splices early items out.
3. `renderFragments` throws (for example boolean script attribute TypeError from EmDash).
4. Page request continues to `EmDashHead` → early CSS/scripts absent with no recovery.

## Why It Might Matter

A render failure in the early waterfall path leaves the page permanently missing critical styles or scripts for the rest of the request, even though those fragments were valid at collection time.

## Proof

**State transition mismatch:** cache state `full` → `stripped` occurs before render success is known. No `try/finally` restores fragments on failure.

## Counterevidence Checked

Happy path works when `renderFragments` succeeds. `script-boolean-render-crash` covers the downstream throw trigger. README documents intentional dedupe with `EmDashHead` but not strip-before-success ordering.

## Suggested Next Step

Move `removeEarlyTakiFragments` after successful `renderFragments`, or copy the array before mutating and only commit removal on success.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Static ordering proof from source; pairs with EmDash render throw paths.

DEVANA-KEY: src/index.ts:460-472,813-816 | renderTakiStart-strip-before-render
DEVANA-SUMMARY: open | P2 | high | renderTakiStart splices early fragments from the shared cache before renderFragments succeeds, so a render error leaves the cache permanently stripped.