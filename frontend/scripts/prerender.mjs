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
    console.error("No HTML source available to write index.html!");
    return;
  }

  // 3. Find the newest compiled client entry JS and CSS from .output/public/assets
  const outputAssetsDir = path.resolve(frontendDir, ".output/public/assets");
  if (fs.existsSync(outputAssetsDir)) {
    const assetFiles = fs.readdirSync(outputAssetsDir);
    const latestIndexJs = assetFiles
      .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
      .sort((a, b) => fs.statSync(path.join(outputAssetsDir, b)).mtimeMs - fs.statSync(path.join(outputAssetsDir, a)).mtimeMs)[0];
    const latestCss = assetFiles
      .filter((f) => f.startsWith("styles-") && f.endsWith(".css"))
      .sort((a, b) => fs.statSync(path.join(outputAssetsDir, b)).mtimeMs - fs.statSync(path.join(outputAssetsDir, a)).mtimeMs)[0];

    if (latestIndexJs) {
      console.log(`Injecting latest entry script: /assets/${latestIndexJs}`);
      html = html.replace(/\/assets\/index-[a-zA-Z0-9_-]+\.js/g, `/assets/${latestIndexJs}`);
    }
    if (latestCss) {
      console.log(`Injecting latest stylesheet: /assets/${latestCss}`);
      html = html.replace(/\/assets\/styles-[a-zA-Z0-9_-]+\.css/g, `/assets/${latestCss}`);
    }
  }

  // 4. Remove broken SSR stream barrier that forces hydration for "/"
  const barrierTag = '<script class="$tsr" id="$tsr-stream-barrier">';
  if (html.includes(barrierTag)) {
    const start = html.indexOf(barrierTag);
    const end = html.indexOf("</script>", start) + 9;
    html = html.slice(0, start) + html.slice(end);
    console.log("Removed SSR stream barrier to enable pure client SPA routing across all subroutes");
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
    path.resolve(frontendDir, "index.html"),
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
