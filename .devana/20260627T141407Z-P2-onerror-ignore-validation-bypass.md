DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | high | security=no
DEVANA-KEY: src/index.ts:439-449,662-676,741-752,1039 | onerror-ignore-validation-bypass

# onError ignore does not protect resolver output from attribute validation throws

## Finding

`resolve({ onError: "ignore" })` is documented to tolerate resolver failures. When a resolver returns successfully but includes a fragment with an invalid attribute name, `collectFragments` throws from `validateAttributeNames` outside the resolver try/catch. The entire `resolveTakiContributions` call rejects despite `onError: "ignore"`.

## Violated Invariant Or Contract

README documents `onError: "ignore"` (default) as continuing after resolver failure, versus `"throw"` failing the hook. Callers expect resolver-returned invalid fragments to be ignored or handled like resolver throws, not to abort collection when `onError` is `ignore`.

## Oracle

README L676–677, L699–700 (`onError` modes); `src/index.ts:741-752` (`handleResolverError` only in `resolveRules` catch); `test/attributes.test.mjs` (validation throws abort `resolveTakiContributions` for static rules).

## Counterexample

```js
await resolveTakiContributions(
  [resolve({ onError: "ignore" })],
  page,
  {
    ctx: { log: { warn() {} } },
    resolve: () => [
      externalScript("/x.js", { attributes: { "bad name": "x" } }),
    ],
  },
);
// rejects: Invalid HTML attribute name "bad name"
```

## Why It Might Matter

Template handlers that return mixed valid metadata and one bad fragment cannot use `onError: "ignore"` to keep partial output. A single malformed attribute from dynamic data fails the whole head resolution path.

## Proof

**Control-flow trace:** resolver returns → `normalizeResolverResult` succeeds → `resolveTakiContributions` → `collectFragments` → `validateAttributeNames` throws → propagates out of `resolveTakiContributions` without consulting `rule.onError`.

Distinct from `metadata-blocked-invalid-fragments`, which covers hook-registration entrypoint impact when the fragment hook is off.

## Counterevidence Checked

`metadata-blocked-invalid-fragments` addresses metadata loss when fragment hook is not registered. Static invalid rules are intentionally rejected in tests. No code path maps validation errors back to `handleResolverError`.

## Suggested Next Step

Wrap per-rule fragment collection in try/catch that respects the originating resolver rule's `onError`, or validate resolver-returned attributes inside `resolveRules` before merging.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Confirmed rejection with `onError: "ignore"` and invalid resolver-returned attribute.
- 2026-06-27: fixed. Confirmed `validateAttributeNames` fired in `collectFragments`, after the resolver loop and outside its try/catch, so an invalid attribute in resolver-returned fragment output aborted the whole resolve pass regardless of `rule.onError`. Fix: validate the resolver's fragment output inside the resolver's own try/catch (before merging) via `validateStaticFragmentAttributes(normalized.rules, page)`, so a throw routes through `handleResolverError` and respects `onError` — `"ignore"` drops that resolver's contribution and warns (consistent with how a resolver throw is treated), `"throw"` rethrows and fails the page. Reconciled with [[metadata-blocked-invalid-fragments]]: that fix gates fragment collection on `usesFragments(rules)` so a metadata-only resolver's valid metadata survives a bad fragment; I gate this new resolver-output validation on the same `usesFragments(rules)` so it does not run (and thus does not drop the resolver's metadata) when fragments are not in use. Note the literal report counterexample (`resolve()` without `fragments: true`) no longer collects fragments at all post-[[metadata-blocked-invalid-fragments]]; this fix covers the live case of a `fragments: true` resolver with `onError: "ignore"`. Added regression tests "resolver onError ignore tolerates invalid attributes in resolver fragment output" and "resolver onError throw still rejects invalid attributes in resolver fragment output". typecheck clean, full suite green (41 tests).

DEVANA-KEY: src/index.ts:439-449,662-676,741-752,1039 | onerror-ignore-validation-bypass
DEVANA-SUMMARY: fixed | P2 | high | Resolver-returned fragment attributes are now validated inside the resolver try/catch (gated on usesFragments), so onError ignore tolerates them and onError throw fails, instead of always aborting in collectFragments.