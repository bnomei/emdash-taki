/** Typed-helper escaping versus raw htmlFragment/inlineScript/inlineStyle trust boundaries. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  baseHref,
  htmlFragment,
  inlineScript,
  inlineStyle,
  resolveTakiContributions,
} from "../dist/index.mjs";

const page = { kind: "page", pageType: "page", path: "/", locale: null };

test("typed HTML helpers escape attribute values", async () => {
  const { fragments } = await resolveTakiContributions(
    [baseHref('/docs?x="<script>alert(1)</script>&y=1')],
    page,
  );

  assert.equal(
    fragments[0].html,
    '<base href="/docs?x=&quot;&lt;script&gt;alert(1)&lt;/script&gt;&amp;y=1">',
  );
});

test("raw helpers preserve trusted HTML, script, and style escape-hatch content", async () => {
  const rawHtml = '<meta name="x" content="<unsafe>&raw">';
  const rawScript = 'window.example = "<unsafe>&raw";';
  const rawCss = 'body::before { content: "<unsafe>&raw"; }';

  const { fragments } = await resolveTakiContributions(
    [htmlFragment(rawHtml), inlineScript(rawScript), inlineStyle(rawCss)],
    page,
  );

  assert.equal(fragments[0].html, rawHtml);
  assert.equal(fragments[1].code, rawScript);
  assert.equal(fragments[2].html, `<style>${rawCss}</style>`);
});

test("inlineStyle prevents literal closing style tags from breaking the wrapper", async () => {
  const { fragments } = await resolveTakiContributions(
    [inlineStyle('body::after { content: "</style><script>alert(1)</script>"; }')],
    page,
  );

  assert.equal(
    fragments[0].html,
    '<style>body::after { content: "<\\/style><script>alert(1)</script>"; }</style>',
  );
});
