DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: open
Location: src/index.ts:552-567,570-572 | Slug: runtime-reserved-keys

# defineTakiRuntime drops templates when reserved keys appear in shorthand maps

## Finding

`defineTakiRuntime()` treats any object with a `resolve`, `resolvers`, or `templates` property as `TakiRuntimeConfig` instead of a shorthand template module map. In that mode it copies only those three fields and silently discards every other top-level entry, so template handlers never register.

## Violated Invariant Or Contract

`TakiRuntimeInput` allows a shorthand `TakiTemplateModuleMap` (`{ [templateName]: module }`). Manual maps must register all template exports unless the nested `{ templates: { ... } }` config form is intentionally used.

## Oracle

`defineTakiRuntime({ article: fn, product: fn })` registers both templates. A map that also contains a reserved key should not drop unrelated template entries without error.

## Counterexample

```ts
defineTakiRuntime({
  article: () => [meta("description", "article")],
  product: () => [meta("description", "product")],
  resolve: () => [meta("description", "from-default-resolver")],
});
```

`isRuntimeConfig()` is true because `"resolve" in input`. `normalizeRuntimeInput()` keeps only `resolve` / `resolvers` / `templates`. The `article` and `product` handlers are discarded. Pages with `pageType: "article"` find no template resolver and receive no dynamic metadata.

## Why It Might Matter

A page type or file named `resolve`, a mistaken top-level `templates` key on a shorthand map, or mixing shorthand templates with a stray reserved property causes silent loss of all template head contributions with no error at registration time.

## Proof

**Control-flow trace:** `defineTakiRuntime(manualMap)` → `normalizeRuntimeInput` → `isRuntimeConfig` (`"resolve" in input || ...`) → config branch extracts three fields only → `createPlugin` → `createTemplateDispatcher` → `templateResolvers["article"]` is `undefined` → resolver returns `null`.

**State transition mismatch:** Input shape matches documented shorthand template map, but normalization switches to config mode and drops state.

## Counterevidence Checked

- Vite `import.meta.glob("./taki/*.{ts,js}")` keys are file paths, not bare reserved names; the default workflow is unaffected.
- Explicit nested `{ templates: { article: fn }, resolvers: { ... } }` is handled correctly.
- No test covers shorthand maps that include reserved property names.

## Suggested Next Step

Narrow `isRuntimeConfig` to distinguish intentional config objects from shorthand maps (for example require a function-typed `resolve`, or a `templates` value that is a record of modules), or throw when reserved keys coexist with non-reserved template entries.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.

DEVANA-KEY: src/index.ts:570-572 | P2 | runtime-reserved-keys
DEVANA-SUMMARY: Status=open | P2 high src/index.ts:570-572 - Reserved-key detection in defineTakiRuntime silently drops shorthand template map entries when resolve, resolvers, or templates is present.