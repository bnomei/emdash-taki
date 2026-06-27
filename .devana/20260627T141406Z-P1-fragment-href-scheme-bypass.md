DEVANA-FINDING: v1
DEVANA-STATE: open | P1 | high | security=yes
DEVANA-KEY: src/index.ts:1032-1108,1251-1271 | fragment-href-scheme-bypass

# Typed fragment helpers emit unsafe href and src schemes EmDash blocks for metadata

## Finding

Metadata `link()` contributions are filtered by EmDash `isSafeHref` (`http://`, `https://`, `at://` only). Fragment helpers (`feed()`, `linkTag()`, `preconnect()`, `stylesheet()`, `externalScript()`, and Cloudflare script helpers) route URLs through `resolveAssetUrl()` and emit HTML or external-script fragments without an equivalent scheme gate. `javascript:`, `data:`, and protocol-relative `//` URLs reach the rendered head.

## Violated Invariant Or Contract

README documents metadata `link()` hrefs as scheme-restricted at render time. Typed fragment helpers are presented as the escaped, safer alternative to raw HTML for resources. Fragment link and script outputs should not bypass the same scheme policy when the semantic rel or resource type matches metadata links.

## Oracle

README L922–926 (metadata safe schemes); `node_modules/emdash/src/page/metadata.ts` L42–44, L110–116; `SECURITY.md` (typed helpers centralize escaping); `src/index.ts:1257-1258` (`//` and arbitrary schemes pass through `resolveAssetUrl`).

## Counterexample

```js
feed("javascript:alert(1)")
// → <link rel="alternate" href="javascript:alert(1)" title="RSS" type="application/rss+xml">

externalScript("//evil.example/x.js")
// → <script src="//evil.example/x.js"></script>

link("alternate", "javascript:alert(1)")
// dropped by EmDash isSafeHref at metadata render
```

Resolver-returned `assetMap` can remap a benign key to an unsafe mapped value; `resolveAssetUrl` returns mapped output without re-validation.

## Why It Might Matter

CMS or resolver data that should be constrained like metadata links can be routed through `feed()`, `linkTag("canonical", ...)`, or script helpers and load attacker-controlled origins or script URLs. This is a trust-boundary gap distinct from documented raw helpers.

## Proof

**Dataflow trace:** rule `href`/`src` → `resolveAssetUrl` (no `isSafeHref`) → `renderLinkFragment` / `collectFragments` external-script → `kind: "html"` or `external-script` contribution → EmDash `renderFragments` escapes but does not filter schemes.

**Cross-entry mismatch:** `link("canonical", unsafe)` is rejected; `linkTag("canonical", unsafe)` emits raw HTML fragment.

## Counterevidence Checked

Raw `htmlFragment()` bypass is documented in `SECURITY.md`. `allowedHosts` applies only to `ctx.http`, not fragment URLs (documented). `basehref-javascript-scheme` covers `<base>` only. `link-fragment-event-handlers` covers `on*` attributes, not scheme filtering.

## Suggested Next Step

Apply the same safe-scheme check used by EmDash metadata to fragment `href`/`src` after `resolveAssetUrl`, or reject unsafe mapped `assetMap` outputs before collection.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Confirmed `feed("javascript:...")` and `externalScript("//...")` render unsafe URLs.

DEVANA-KEY: src/index.ts:1032-1108,1251-1271 | fragment-href-scheme-bypass
DEVANA-SUMMARY: open | P1 | high | Fragment link and script helpers emit javascript:, data:, and // URLs that metadata link() would block, including via assetMap remaps.