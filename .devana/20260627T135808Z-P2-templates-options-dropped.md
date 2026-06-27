DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:535-550,391-399 | templates-options-dropped

# Plugin templates options are dropped when an explicit template rule exists

## Finding

When `takiPlugin({ runtime, templates: { fragments: true }, rules: [template("article")] })` is configured, auto-registration of `templates()` is suppressed because an explicit template resolver rule exists. The plugin-level `templates` options are not merged into that explicit rule, so `fragments: true` is lost and the fragment hook is not registered.

## Violated Invariant Or Contract

README documents `templates: { fragments: true }` on `takiPlugin()` for opting automatic templates into fragments (`README.md` L302-309, L508-509). Adding an explicit `template("article")` rule should not silently discard those options.

## Oracle

`shouldAutoRegisterTemplates()` (`546-550`), `createRules()` (`535-544`), `template()` helper (`391-399`), and README automatic template registration docs (`647-649`).

## Counterexample

```js
takiPlugin({
  runtime: "./src/emdash-taki-runtime.ts",
  templates: { fragments: true },
  rules: [template("article")],
})
// desc.options.rules[0] has fragments: undefined
// capabilities lacks hooks.page-fragments:register
```

## Why It Might Matter

Projects that add an explicit `template()` rule for one page type lose fragment hook registration for template-returned HTML fragments, so dynamic fragments never render despite `templates: { fragments: true }` in config.

## Proof

Contract mismatch: documented `templates: { fragments: true }` plugin option → `shouldAutoRegisterTemplates` returns false when `isTemplateResolverRule` matches → `createRules` does not inject `templates(templateOptions)` → explicit `template()` rule keeps default `fragments: undefined`.

## Counterevidence Checked

- `templates: { fragments: true }` works when no explicit template rule exists (auto-register path).
- Callers can pass `{ fragments: true }` directly on `template("article", { fragments: true })`; the bug is silent loss of plugin-level options.
- `shouldAutoRegisterTemplates` only checks `resolver === "templates"`, not `resolve()` rules (separate finding).

## Suggested Next Step

Merge plugin `templates` options into explicit template rules, or document that `templates` options apply only to auto-registered rules.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Verified `takiPlugin({ runtime, templates: { fragments: true }, rules: [template("article")] })` yields `fragments: undefined` on the rule.

DEVANA-KEY: src/index.ts:535-550,391-399 | templates-options-dropped
DEVANA-SUMMARY: open | P2 | high | Plugin templates: { fragments: true } is ignored when an explicit template() rule blocks auto-registration, so the fragment hook never registers.