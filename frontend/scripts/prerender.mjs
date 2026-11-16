import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "..");

async function generateHtml() {
  const distDir = path.resolve(frontendDir, "dist");
  const fallbackHtmlPath = path.resolve(frontendDir, "index.html");

  // 1. Copy all client assets from .output/public, dist/client, etc. into dist/
  const sources = [
    path.resolve(frontendDir, ".output/public"),
    path.resolve(frontendDir, "dist/client"),
    path.resolve(frontendDir, ".vercel/output/static"),
  ];
  for (const src of sources) {
    if (fs.existsSync(src)) {
      try {
        fs.cpSync(src, distDir, { recursive: true });
        console.log(`Copied assets from ${src} into dist/`);
      } catch (err) {
        console.warn(`Failed copying from ${src}:`, err.message);
      }
    }
  }

  // 2. Read template HTML
  let html = null;
  if (fs.existsSync(fallbackHtmlPath)) {
    html = fs.readFileSync(fallbackHtmlPath, "utf8");
    console.log(`Loaded base index.html template (${html.length} bytes)`);
  }

  if (!html) {
    throw new Error("No HTML source available to write index.html");
  }

  // 3. Find the newest compiled client entry JS and CSS from .output/public/assets
  const outputAssetsDir = path.resolve(frontendDir, ".output/public/assets");
  if (!fs.existsSync(outputAssetsDir)) {
    throw new Error(`Compiled client assets directory is missing: ${outputAssetsDir}`);
  }
  const assetFiles = fs.readdirSync(outputAssetsDir);
  const latestIndexJs = assetFiles
    .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
    .sort((a, b) => fs.statSync(path.join(outputAssetsDir, b)).mtimeMs - fs.statSync(path.join(outputAssetsDir, a)).mtimeMs)[0];
  const latestCss = assetFiles
    .filter((f) => f.startsWith("styles-") && f.endsWith(".css"))
    .sort((a, b) => fs.statSync(path.join(outputAssetsDir, b)).mtimeMs - fs.statSync(path.join(outputAssetsDir, a)).mtimeMs)[0];

  if (!latestIndexJs || !latestCss) {
    throw new Error(`Compiled client entry or stylesheet is missing from ${outputAssetsDir}`);
  }

  console.log(`Injecting latest entry script: /assets/${latestIndexJs}`);
  html = html.replace(/\/assets\/index-[a-zA-Z0-9_-]+\.js/g, `/assets/${latestIndexJs}`);
  console.log(`Injecting latest stylesheet: /assets/${latestCss}`);
  html = html.replace(/\/assets\/styles-[a-zA-Z0-9_-]+\.css/g, `/assets/${latestCss}`);

  html = html.replace(
    /<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>/gi,
    "",
  );
  if (!html.includes('id="$tsr-stream-barrier"')) {
    const entryScriptUrl = `/assets/${latestIndexJs}`;
    // Static Nginx output needs the router state TanStack Start normally streams.
    const bootstrapScript = `<script class="$tsr" id="$tsr-stream-barrier">(self.$R=self.$R||{})["tsr"]=[];self.$_TSR={h(){this.hydrated=!0,this.c()},e(){this.streamEnded=!0,this.c()},c(){this.hydrated&&this.streamEnded&&(delete self.$_TSR,delete self.$R.tsr)},p(e){this.initialized?e():this.buffer.push(e)},buffer:[]};$_TSR.router={manifest:{routes:{"__root__":{preloads:["${entryScriptUrl}"],scripts:[{attrs:{type:"module",async:!0,src:"${entryScriptUrl}"}}]},"/":{preloads:[]}}},matches:[{i:"__root__\\0",u:Date.now(),s:"success",ssr:!0},{i:"\\0\\0",u:Date.now(),s:"success",ssr:!0}],lastMatchId:"\\0\\0"};$_TSR.e();document.currentScript.remove()</script>`;
    const headEnd = html.indexOf("</head>");
    if (headEnd === -1) {
      throw new Error("Generated HTML is missing its closing </head> tag");
    }
    html = `${html.slice(0, headEnd)}${bootstrapScript}${html.slice(headEnd)}`;
  }

  const assetReferences = [
    ...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g),
  ].map((match) => match[1]);
  const missingAssets = [
    ...new Set(
      assetReferences.filter(
        (asset) => !fs.existsSync(path.join(distDir, "assets", asset)),
      ),
    ),
  ];
  if (missingAssets.length > 0) {
    throw new Error(
      `Generated HTML references missing assets: ${missingAssets.join(", ")}`,
    );
  }

  // Ensure visiting /index.html directly normalizes to / so TanStack Router does not show blank
  const normalizeScript = `<script>if(window.location.pathname.endsWith("/index.html")){const target=(window.location.pathname.replace(/\\/index\\.html$/,"")||"/")+window.location.search+window.location.hash;window.history.replaceState(null,"",target);}</script>`;
  if (!html.includes('pathname.endsWith("/index.html")')) {
    html = html.replace("<head>", "<head>" + normalizeScript);
  }

  // 5. Write updated index.html to all possible deployment targets
  const targets = [
    path.resolve(frontendDir, "dist/index.html"),
    path.resolve(frontendDir, "dist/client/index.html"),
    path.resolve(frontendDir, ".vercel/output/static/index.html"),
    path.resolve(frontendDir, ".output/public/index.html"),
  ];

  for (const target of targets) {
    const dir = path.dirname(target);
    if (fs.existsSync(dir)) {
      fs.writeFileSync(target, html, "utf8");
      console.log(`Generated ${target} (${html.length} bytes)`);
    }
  }

  // 6. Mirror dist/assets to frontend/assets
  const distAssets = path.resolve(frontendDir, "dist/assets");
  const rootAssets = path.resolve(frontendDir, "assets");
  if (fs.existsSync(distAssets)) {
    try {
      if (fs.existsSync(rootAssets)) {
        fs.rmSync(rootAssets, { recursive: true, force: true });
      }
      fs.cpSync(distAssets, rootAssets, { recursive: true });
      console.log("Mirrored dist/assets to frontend/assets");
    } catch (err) {
      console.warn("Failed mirroring assets to root:", err.message);
    }
  }
}

generateHtml();
