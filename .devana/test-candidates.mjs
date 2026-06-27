import { 
  externalScript,
  inlineScript,
  stylesheet,
  resolveTakiContributions
} from "./dist/index.mjs";
import { resolveFragments, renderFragments } from "emdash/page.mjs";

const page = {
  kind: "content",
  pageType: "test",
  path: "/test",
  locale: "en",
  title: "Test",
  url: "https://example.test",
  siteUrl: "https://example.test",
};

const ctx = { log: { warn() {} } };

// Candidate 1: Same key, different phase
console.log("\n=== CANDIDATE 1: Same key with different phase ===\n");

async function testCandidate1() {
  const rules = [
    stylesheet("src/styles/old.css", { key: "theme-style", phase: "early" }),
    stylesheet("src/styles/new.css", { key: "theme-style" }), // late by default
  ];

  const { fragments } = await resolveTakiContributions(rules, page, { ctx });
  
  console.log("Rules:", rules.map(r => ({ key: r.key, phase: r.phase })));
  console.log("\nFragments after collection:");
  fragments.forEach((f, i) => {
    if (f.kind === "html") {
      console.log(`  [${i}] ${f.kind} key="${f.key}" html="${f.html.substring(0, 50)}..."`);
    }
  });
  
  const deduped = fragments;
  console.log("\nFragments after dedupeFragmentsLastWins:");
  deduped.forEach((f, i) => {
    if (f.kind === "html") {
      console.log(`  [${i}] ${f.kind} key="${f.key}"`);
    }
  });

  if (deduped.length === 2) {
    console.log("\n❌ BUG CONFIRMED: Both fragments survived (expected 1)");
    console.log("   Different dedupe keys due to phase prefix:");
    console.log("   - emdash-taki:early:theme-style");
    console.log("   - theme-style");
  } else if (deduped.length === 1) {
    console.log("\n✓ No bug: Only 1 fragment (as expected)");
  }
}

// Candidate 2: Reordering due to dedupeLastWins
console.log("\n=== CANDIDATE 2: dedupeLastWins reordering ===\n");

async function testCandidate2() {
  const rules = [
    externalScript("https://cdn.example/lib.js", { key: "lib" }),
    inlineScript("lib.doSomething();", { key: "init" }),
    externalScript("https://cdn.example/lib.js", { key: "lib" }), // override
  ];

  const { fragments } = await resolveTakiContributions(rules, page, { ctx });
  
  console.log("Rules:", rules.map((r, i) => ({ 
    i, 
    kind: r.kind, 
    key: r.key, 
    phase: r.phase 
  })));

  console.log("\nFragments in order after collection:");
  fragments.forEach((f, i) => {
    const desc = f.kind === "external-script" 
      ? `${f.kind} src="${f.src}" key="${f.key}"`
      : `${f.kind} key="${f.key}"`;
    console.log(`  [${i}] ${desc}`);
  });

  // Find the positions of lib and init in the deduped output
  const libIndex = fragments.findIndex(f => f.key === "lib" || (f.kind === "external-script" && f.src === "https://cdn.example/lib.js"));
  const initIndex = fragments.findIndex(f => f.key === "init" || (f.kind === "inline-script"));

  console.log("\nPositions after dedupe:");
  console.log(`  lib (external-script) at index: ${libIndex}`);
  console.log(`  init (inline-script) at index: ${initIndex}`);

  if (initIndex < libIndex && initIndex !== -1 && libIndex !== -1) {
    console.log("\n❌ BUG CONFIRMED: init comes BEFORE lib");
    console.log("   This breaks the dependency: init calls lib.doSomething()");
    console.log("   But lib.js hasn't loaded yet!");
  } else if (libIndex < initIndex || libIndex === -1 || initIndex === -1) {
    console.log("\n✓ No bug: lib comes before init (or one is missing)");
  }
}

await testCandidate1();
await testCandidate2();
