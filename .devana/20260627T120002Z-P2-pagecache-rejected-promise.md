DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | high | security=no
DEVANA-KEY: src/index.ts:167-179 | pagecache-rejected-promise

# pageCache stores rejected resolver promises permanently

## Finding

`createPlugin` caches the `resolveTakiContributions` promise in a `WeakMap` before it settles. If that promise rejects, every later hook call for the same page object reuses the same rejected promise instead of re-running resolution.

## Violated Invariant Or Contract

A per-page cache should reuse successful or in-flight results. After a recoverable or corrected retry, resolution should be allowed to run again for the same page object within the plugin instance.

## Oracle

README documents reuse of pending or fulfilled resolver promises for the same page object. It does not describe pinning terminal failures. Typical cache patterns either store successes only or invalidate entries on rejection.

## Counterexample

```js
let attempt = 0;
const plugin = createPlugin(
  { rules: [resolve({ onError: "throw" })] },
  {
    resolve: () => {
      attempt += 1;
      if (attempt === 1) throw new Error("transient");
      return meta("ok", "recovered");
    },
  },
);

const page = { kind: "page", pageType: "page", path: "/" };
const ctx = { log: { warn() {} } };

await assert.rejects(() => plugin.hooks["page:metadata"].handler({ page }, ctx));
await assert.rejects(() => plugin.hooks["page:metadata"].handler({ page }, ctx));
// attempt stays 1; second call never re-enters the resolver
```

## Why It Might Matter

Any caller that retries metadata or fragment collection on the same page object after a thrown resolver or validation error is permanently stuck until a new page object is allocated, even if the underlying failure was transient or corrected.

## Proof

**State transition mismatch:** `resolveForPage` inserts into `pageCache` immediately (`src/index.ts:178`) with no rejection handler to evict the entry. Subsequent calls hit `pageCache.get(page)` (`src/index.ts:168-169`) and propagate the cached rejection.

**Control-flow trace:** `page:metadata` handler → `resolveForPage` → cached rejected `Promise` → hook throws without calling `resolveTakiContributions` again.

## Counterevidence Checked

- EmDash normally constructs a fresh page context per request, which limits cross-request impact.
- `onError: "ignore"` avoids rejection for resolver exceptions, but validation throws (for example invalid attribute names) still reject and pin the cache.
- Within a single failed render, both metadata and fragments hooks sharing one rejection is correct; the issue is inability to retry on the same object.

## Suggested Next Step

Cache only in-flight promises and move settled successes to a separate entry, or delete the cache entry in a `.catch` handler on the stored promise so a later call can re-resolve.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed `resolveForPage` stored the `resolveTakiContributions` promise in the WeakMap with no rejection handler, so a thrown resolver (onError:"throw") or a validation throw pinned the rejection and every later hook call on the same page object replayed it. Attached a `.catch` that deletes the entry on rejection, guarded by `pageCache.get(page) === promise` to avoid evicting a newer entry. The returned promise still rejects to the caller — only the cache is cleared — and the catch chain handles its own rejection so there is no unhandled rejection. Successful and in-flight promises remain cached. Added regression test "evicts rejected resolver promises so the same page object can retry" (transient throw on attempt 1, recovers on attempt 2). Full suite green (24 tests).

DEVANA-KEY: src/index.ts:167-179 | pagecache-rejected-promise
DEVANA-SUMMARY: fixed | P2 | high | resolveForPage now evicts the pageCache entry on rejection so a transient/corrected failure can retry on the same page object; successes stay cached.