DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:439-449,1022-1068 | resolver-before-attribute-validation

# Resolver side effects run before attribute validation can fail

## Finding

`resolveTakiContributions` awaits the full `resolveRules` loop before `collectFragments` validates HTML attribute names. A static fragment rule with invalid attributes still lets later resolver rules execute, so resolver side effects commit even when collection will ultimately throw.

## Violated Invariant Or Contract

Invalid static configuration should fail before optional resolver work runs, or at least before resolvers with external side effects execute. Validation tests describe rejection before renderer handoff, not after resolver execution.

## Oracle

`test/attributes.test.mjs` expects `resolveTakiContributions` to throw on invalid attribute names before contributions reach the renderer. Resolver rules commonly use `ctx.content`, `ctx.http`, or other stateful APIs per README.

## Counterexample

```js
let resolverRan = false;

await assert.rejects(
  () =>
    resolveTakiContributions(
      [
        externalScript("/a.js", { attributes: { "bad name": "x" } }),
        resolve({ onError: "throw" }),
      ],
      page,
      {
        ctx,
        resolve: () => {
          resolverRan = true;
          return meta("from-resolver", "ok");
        },
      },
    ),
  /Invalid HTML attribute name/,
);

// resolverRan === true even though the static rule guarantees collection failure
```

## Why It Might Matter

A configuration mistake in an earlier static fragment rule can still trigger network requests, content reads, or writes in later resolvers before the pipeline throws, causing duplicate work or partial external effects on pages that never render valid head output.

## Proof

**Control-flow trace:** `resolveTakiContributions` (`src/index.ts:444`) awaits `resolveRules` completely, including all resolver invocations (`src/index.ts:662-676`). `validateAttributeNames` is first reached inside `collectFragments` (`src/index.ts:1039`, `1047`, `1151`) after resolvers finish.

**Dataflow trace:** invalid static rule enters `resolvedRules` unchanged (`src/index.ts:647-650`) → subsequent resolver executes → `collectFragments` throws on the earlier rule.

## Counterevidence Checked

- Two-phase resolve-then-collect structure appears deliberate for merging resolver `assetMap` output before URL resolution.
- Invalid attributes are caller bugs; the bug is ordering relative to resolver side effects, not whether validation exists.
- Plugin hooks always run the same ordering, so production paths share the behavior.

## Suggested Next Step

Validate static fragment attribute names when rules are first admitted to `resolvedRules`, or run a preflight validation pass over static rules before invoking any resolver.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.

DEVANA-KEY: src/index.ts:439-449,1022-1068 | resolver-before-attribute-validation
DEVANA-SUMMARY: open | P2 | high | resolveRules runs all resolvers before collectFragments validates attributes, so resolver side effects commit even when a static rule will abort collection.