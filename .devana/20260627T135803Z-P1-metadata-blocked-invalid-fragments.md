DEVANA-FINDING: v1
DEVANA-STATE: open | P1 | high | security=no
DEVANA-KEY: src/index.ts:188-191,439-449,1203-1214 | metadata-blocked-invalid-fragments

# Invalid resolver fragments block metadata when fragment hook is off

## Finding

The `page:metadata` hook always calls `resolveTakiContributions()`, which always runs `collectFragments()`. When no static or opted-in resolver registers the fragment hook, invalid fragment output from a resolver still aborts metadata collection, causing the metadata hook to reject even though fragments are never published.

## Violated Invariant Or Contract

README states resolvers should set `fragments: true` when returning page fragments. The implied contract is that metadata-only resolvers are not blocked by fragment validation when the fragment hook is not registered.

## Oracle

README fragment opt-in guidance (`README.md` L481-484, L672-674), `usesFragments()` gating for `page:fragments` (`src/index.ts` L1203-1214), and EmDash hook error handling that drops failed plugin metadata.

## Counterexample

```js
createPlugin({ rules: [resolve()] }, {
  resolve: () => [
    meta("description", "ok"),
    { kind: "external-script", placement: "head", src: "/x.js", attributes: { "bad name": "x" } },
  ],
})
// page:fragments hook: undefined
// page:metadata handler → throws Invalid HTML attribute name "bad name"
// metadata "ok" never reaches EmDash
```

## Why It Might Matter

A single malformed fragment attribute in a resolver return value silently drops all plugin metadata for the page, including valid meta tags, with no fragment output to compensate.

## Proof

Control-flow trace: `page:metadata` handler (`190`) → `resolveTakiContributions` (`439-449`) → `collectFragments` (`1022-1068`) → `validateAttributeNames` throws → hook rejects. `usesFragments(rules)` is false because `resolve()` has no `fragments: true` and no static fragment rules, so `page:fragments` is not registered (`192-199`).

## Counterevidence Checked

- When `fragments: true` is set, both hooks run; the failure still occurs but fragments were intended.
- `resolver-before-attribute-validation` covers resolver side effects before validation; this report is the entrypoint impact when the fragment hook is off.
- Attribute validation itself is correct; the bug is coupling metadata collection to fragment validation.

## Suggested Next Step

Skip `collectFragments()` when `usesFragments(rules)` is false, or validate/collect metadata and fragments independently so metadata-only plugins are isolated from fragment errors.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced via `createPlugin` metadata hook throw while `page:fragments` was undefined.

DEVANA-KEY: src/index.ts:188-191,439-449,1203-1214 | metadata-blocked-invalid-fragments
DEVANA-SUMMARY: open | P1 | high | Metadata hook always collects fragments, so invalid resolver fragment output drops all plugin metadata even when the fragment hook is not registered.