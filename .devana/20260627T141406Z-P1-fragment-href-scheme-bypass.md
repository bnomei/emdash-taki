DEVANA-FINDING: v1
DEVANA-STATE: fixed | P1 | high | security=yes
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

- 2026-06-27: fixed (executable-scheme bypass) + documented decision on protocol-relative URLs. The core security gap — `javascript:`/`data:`/`vbscript:`/`file:`/`blob:` schemes reaching rendered head fragments via `feed()`, `linkTag()`, `preconnect()`, `stylesheet()`, `externalScript()`, and Cloudflare script helpers, including through assetMap remaps — is closed by the `isSafeFragmentUrl` gate introduced for [[basehref-javascript-scheme]] and applied (in this same branch) after `resolveAssetUrl` to base, link (renderLinkFragment, which backs every linkTag-based helper), external-script, and Cloudflare scripts. The check normalizes ASCII whitespace/control chars before matching, so split-scheme bypasses are covered too. Verified empirically: feed/linkTag(canonical)/preconnect/stylesheet/externalScript all drop dangerous schemes and warn. The remaining item — protocol-relative `//host` URLs — is intentionally NOT blocked: `//` carries no scheme and inherits the page's https origin, and is a standard, safe convention for loading CDN resources (scripts, stylesheets, feeds); blocking it would break legitimate usage and contradicts the resource-loading model. (Metadata link()'s stricter http/https/at-only policy reflects that canonical/alternate links should be absolute self-references; untrusted-origin risk for `//`/absolute resource URLs is an allowedHosts/CSP concern, not a scheme-filter one.) Added regression tests "drops link-based fragment helpers with dangerous URL schemes" and "keeps protocol-relative resource URLs in link fragments" (encoding the intentional `//` allowance). Effectively the same actionable finding as [[basehref-javascript-scheme]] generalized to link/script helpers; resolved by the shared gate. typecheck clean, full suite green (39 tests).

DEVANA-KEY: src/index.ts:1032-1108,1251-1271 | fragment-href-scheme-bypass
DEVANA-SUMMARY: fixed | P1 | high | Dangerous-scheme bypass closed for all fragment link/script helpers via the shared isSafeFragmentUrl gate (after assetMap resolution); protocol-relative // is intentionally allowed as a safe resource convention.