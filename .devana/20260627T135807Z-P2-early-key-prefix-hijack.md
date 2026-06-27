DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | high | security=no
DEVANA-KEY: src/index.ts:452-457,1237-1240 | early-key-prefix-hijack

# User fragment keys can hijack the early-head prefix

## Finding

`isEarlyTakiFragment()` treats any head fragment whose `key` starts with `emdash-taki:early:` as early, but `fragmentKey()` only adds that prefix when `phase === "early"`. A caller-supplied `key` matching the internal prefix is classified as early without setting `phase: "early"`.

## Violated Invariant Or Contract

The `emdash-taki:early:` prefix is an internal implementation detail for waterfall ordering. User-controlled `key` values should not opt fragments into early rendering or `removeEarlyTakiFragments` stripping.

## Oracle

`fragmentKey()` (`1237-1240`), `isEarlyTakiFragment()` (`452-457`), README `phase` documentation (`README.md` L518-521), and tests that only cover helpers setting `phase: "early"`.

## Counterexample

```js
externalScript("/v.js", { key: "emdash-taki:early:vendor" })
// fragmentKey leaves key unchanged (no phase)
// isEarlyTakiFragment(contribution) === true
// renderTakiStart renders it early and removeEarlyTakiFragments strips it from EmDash cache
```

## Why It Might Matter

Resolver or config authors can accidentally—or deliberately—force late scripts into the early waterfall and EmDash cache removal path by naming keys with the reserved prefix.

## Proof

Control-flow trace: `fragmentKey` returns user key verbatim → `isEarlyTakiFragment` prefix match → `renderTakiStart` filter includes fragment → `removeEarlyTakiFragments` splices it out of shared EmDash cache.

## Counterevidence Checked

- README documents `phase`, not prefix reservation.
- Normal helpers set `phase: "early"` and generate prefixed keys consistently.
- `fragmentKey` double-prefix when both `phase: "early"` and key already contains prefix is a separate authoring edge case.

## Suggested Next Step

Classify early fragments by explicit metadata (e.g. stored `phase` field) rather than key prefix alone, or reject user keys starting with `emdash-taki:early:`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced `isEarlyTakiFragment === true` for `externalScript` with manual prefixed key and no `phase`.
- 2026-06-27: fixed. Confirmed `isEarlyTakiFragment` classifies by the `emdash-taki:early:` key prefix while `fragmentKey` only adds that prefix for `phase: "early"`, so a caller key already carrying the prefix is classified early (and stripped from EmDash's cache by `removeEarlyTakiFragments`) without opting in. The prefix-on-key is the intentional carrier for the early signal because the EmDash `PageFragmentContribution` type has no `phase` field to store it, so the namespace is reserved rather than replaceable. Fix: reject caller keys starting with the reserved prefix at the single choke point `fragmentKey`, with an error pointing authors at `{ phase: "early" }`. This also forecloses the double-prefix edge (a `phase:"early"` rule whose key already had the prefix). Legitimate helpers pass an unprefixed base key and let `fragmentKey` add the prefix, so nothing valid breaks. Added regression test "rejects fragment keys that use the reserved early prefix". typecheck clean, full suite green (34 tests).

DEVANA-KEY: src/index.ts:452-457,1237-1240 | early-key-prefix-hijack
DEVANA-SUMMARY: fixed | P2 | high | fragmentKey now rejects caller keys starting with the reserved emdash-taki:early: prefix, so fragments can only enter the early waterfall via phase: "early".