DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:1071-1108,870-880 | link-fragment-attr-dedupe-collapse

# Link fragments differing only by media/type/sizes/as collapse to one

## Finding

`renderLinkFragment` builds a link fragment's dedupe key from `rel` and the
unresolved `href` only:

```ts
key: fragmentKey(rule, `link:${rel}:${href}`)   // src/index.ts:1107
```

But the same function renders `as`, `media`, `type`, `sizes`, `hreflang`,
`crossorigin`, `fetchpriority`, and `title` into the actual `<link>` tag
(src/index.ts:1089-1101). So two `link-tag` rules that share `rel` + `href`,
carry no explicit `key`, and differ only in those attributes produce **identical
dedupe keys**. `dedupeFragmentsLastWins` (src/index.ts:823-847) then treats them
as duplicates and keeps only the last one, silently dropping the other rendered
tag.

The same shape exists for external scripts at src/index.ts:1040
(`script:${rule.src}` ignores `async`/`defer`/`attributes`/nonce).

## Violated Invariant Or Contract

Deduplication must collapse only fragments that render to the same output. Two
contributions that render to *different* HTML (`<link ... sizes="16x16">` vs
`<link ... sizes="32x32">`) must not share a dedupe key. The waterfall helpers
(`stylesheet`, `preload`, `icon`, `linkTag`, …) document `key` as optional, so
correct rendering must not depend on the caller manually disambiguating.

## Oracle

- src/index.ts:1089-1101 destructures and renders `as`/`media`/`type`/`sizes`/
  `hreflang`/`crossorigin`/`fetchpriority`/`title` into the tag, proving they are
  semantically meaningful output.
- src/index.ts:870-880 (`fragmentDedupeKey`) keys off `contribution.key`, which
  for these rules is the rel+href fallback from src/index.ts:1107.
- test/renderer-contract.test.mjs shows distinct `rel` values are kept and
  identical key/src are collapsed — but no test covers same rel+href with
  differing distinguishing attributes.

## Counterexample

```ts
const { fragments } = await resolveTakiContributions(
  [
    icon("/favicon.ico", { sizes: "16x16", type: "image/x-icon" }),
    icon("/favicon.ico", { sizes: "32x32", type: "image/x-icon" }),
  ],
  page,
);
// Both -> key "link:icon:/favicon.ico"; dedupe keeps only the 32x32 tag.
// The 16x16 size hint is silently lost.
```

A media-conditional variant is equally affected:

```ts
stylesheet("/app.css", { media: "screen" });
stylesheet("/app.css", { media: "print" }); // same href -> one survives
```

## Why It Might Matter

Pages lose intended `<link>` variants without warning: a missing icon size hint,
a dropped media-conditional stylesheet/preload, or a lost `as`/`type`/`crossorigin`
combination. The output is a correctness regression that only manifests when two
link rules legitimately share rel+href, and the caller has no signal that a tag
was discarded.

## Proof

Contract mismatch / cross-entry mismatch:
1. Two `linkTag`/`icon`/`stylesheet`/`preload` rules with equal `rel` and `href`,
   no explicit `key`, differing only in rendered attributes.
2. `renderLinkFragment` assigns both `key = link:<rel>:<href>` (1107).
3. `fragmentDedupeKey` returns `fragment:<placement>:key:link:<rel>:<href>` for
   both (871-873).
4. `dedupeLastWins` sees the second occurrence's key already in `seen` and skips
   the earlier one (839), so only one of the two distinct tags reaches output.

## Counterevidence Checked

- Explicit `key`: a caller that sets distinct `key` per rule avoids the
  collapse, but `key` is documented optional, so default behavior is the defect.
- assetMap interaction (filed: `assetmap-fragment-dedupe`) is the *opposite*
  failure (false-negative dedupe → duplicate tags); this is a false-positive
  dedupe (distinct tags collapsed) and is not covered by that report.
- The reverse-then-reverse ordering of `dedupeLastWins` is intended and tested;
  this finding is about key *granularity*, not ordering.
- Strongest false-positive reason: "same rel+href is always a duplicate." Refuted
  by the icon-`sizes` and `media` examples, where same rel+href with different
  attributes is valid, distinct HTML that browsers treat differently.

## Suggested Next Step

Either include the distinguishing attributes (`as`, `media`, `type`, `sizes`,
`hreflang`, `crossorigin`, `fetchpriority`) in the link fragment fallback key (and
`async`/`defer`/attribute hash for external-script), or document that callers must
set an explicit `key` when emitting same-rel+href link variants.

## Agent Handoff

Preserve the original finding body. Update line 2 `DEVANA-STATE:` and the final
`DEVANA-SUMMARY:` prefix when status changes. Keep `DEVANA-KEY:` stable unless the
finding moves.

## Status Notes

- 2026-06-27: open by Devana. Static source inspection; confirmed against
  src/index.ts:1071-1108 and dedupe path 823-880; no covering test found.

DEVANA-KEY: src/index.ts:1071-1108,870-880 | link-fragment-attr-dedupe-collapse
DEVANA-SUMMARY: open | P2 | high | Link fragments sharing rel+href but differing in media/type/sizes/as collapse under last-wins dedupe because the fallback key ignores those rendered attributes, silently dropping distinct tags.
