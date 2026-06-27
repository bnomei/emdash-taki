DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | medium | security=no
DEVANA-KEY: src/index.ts:535-550,546-550 | resolve-templates-double-dispatch

# Explicit resolve rules do not suppress automatic template dispatch

## Finding

When `runtime` is set and the config includes a `resolve()` rule but no explicit `templates()` rule, `shouldAutoRegisterTemplates()` still auto-appends `templates()`. Both the default resolver and the template dispatcher run for the same page.

## Violated Invariant Or Contract

README says automatic template loading is skipped when an explicit template rule already exists (`README.md` L647-648). Projects that add `resolve()` for dynamic cases likely expect that to replace—not stack with—automatic template dispatch.

## Oracle

`shouldAutoRegisterTemplates()` (`546-550`), `isTemplateResolverRule()` (`1229-1231`), README auto-registration wording, and `createRules()` (`535-544`).

## Counterexample

```js
takiPlugin({
  runtime: "./src/emdash-taki-runtime.ts",
  rules: [resolve({ when: { pageType: "article" } })],
})
// desc.options.rules → [
//   { resolver: "default", when: { pageType: "article" }, ... },
//   { resolver: "templates", ... },
// ]
```

Both resolvers execute per page in `resolveRules()` loop order.

## Why It Might Matter

Duplicate resolver work and doubly merged rules/metadata can override static fallbacks unpredictably when both a custom resolver and template file target the same `pageType`.

## Proof

Control-flow trace: `createRules` pushes user `resolve()` rule → `shouldAutoRegisterTemplates` true (no `resolver === "templates"` rule) → appends `templates()` → `resolveRules` runs both sequentially, merging outputs.

## Counterevidence Checked

- README explicitly names suppression condition as an explicit **template** rule, not `resolve()`.
- Double dispatch may be intentional when `resolve()` handles non-template cases only; matchers can limit overlap.
- Distinct from `templates-options-dropped`, which covers plugin `templates` options with explicit `template()`.

## Suggested Next Step

Clarify README if stacking is intentional, or suppress auto `templates()` when any `resolve()` rule is present if that matches product intent.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Verified `takiPlugin({ runtime, rules: [resolve(...)] })` yields two resolver rules: `default` and `templates`.

DEVANA-KEY: src/index.ts:535-550,546-550 | resolve-templates-double-dispatch
DEVANA-SUMMARY: open | P2 | medium | Auto templates() still registers alongside explicit resolve() rules, so default and template resolvers both run per page.