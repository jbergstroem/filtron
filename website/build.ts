import { file, write } from "bun";
import { cleanBuildArtifacts, cleanDist, copyStaticAssets } from "./lib/assets.ts";
import { inlineAssets, minifyHtml, processHtml } from "./lib/html.ts";
import { generateImages } from "./lib/images.ts";
import { copyLlmsDocs, generateLlmsTxt } from "./lib/llms.ts";

const start = performance.now();

await cleanDist();

// Generate llms.txt from README
await generateLlmsTxt();

// Generate social card and app icons
await generateImages();

// Process HTML
let html = await file("index.html").text();
html = await processHtml(html);
html = await inlineAssets(html);
html = minifyHtml(html);
await write("dist/index.html", html);

// Copy assets
await copyStaticAssets();
await copyLlmsDocs();
await cleanBuildArtifacts();

console.log(`Build complete in ${(performance.now() - start).toFixed(0)}ms`);
