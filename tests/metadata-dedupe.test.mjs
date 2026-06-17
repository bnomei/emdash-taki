import assert from "node:assert/strict";
import { test } from "node:test";

import { link, resolveTakiContributions } from "../dist/index.mjs";

const page = {
  url: "https://example.com/articles/example",
  path: "/articles/example",
  locale: null,
  kind: "custom",
  pageType: "website",
  title: null,
  pageTitle: null,
  description: null,
  canonical: null,
  image: null,
};

test("non-canonical links with the same href but different rel values are preserved", async () => {
  const result = await resolveTakiContributions(
    [link("alternate", "https://example.com/about"), link("author", "https://example.com/about")],
    page,
  );

  assert.deepEqual(result.metadata, [
    {
      kind: "link",
      rel: "alternate",
      href: "https://example.com/about",
      hreflang: undefined,
      key: undefined,
    },
    {
      kind: "link",
      rel: "author",
      href: "https://example.com/about",
      hreflang: undefined,
      key: undefined,
    },
  ]);
});

test("non-canonical links with the same rel and href still dedupe last wins", async () => {
  const result = await resolveTakiContributions(
    [
      link("alternate", "https://example.com/about", { hreflang: "en" }),
      link("alternate", "https://example.com/about", { hreflang: "en" }),
    ],
    page,
  );

  assert.deepEqual(result.metadata, [
    {
      kind: "link",
      rel: "alternate",
      href: "https://example.com/about",
      hreflang: "en",
      key: undefined,
    },
  ]);
});

test("canonical links continue to dedupe regardless of href", async () => {
  const result = await resolveTakiContributions(
    [
      link("canonical", "https://example.com/first"),
      link("canonical", "https://example.com/second"),
    ],
    page,
  );

  assert.deepEqual(result.metadata, [
    {
      kind: "link",
      rel: "canonical",
      href: "https://example.com/second",
      hreflang: undefined,
      key: undefined,
    },
  ]);
});
