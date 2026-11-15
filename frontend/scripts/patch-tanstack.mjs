import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patchFile(relativePath, patch) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return;

  const source = fs.readFileSync(filePath, "utf8");
  const updated = patch(source);
  if (updated !== source) fs.writeFileSync(filePath, updated);
}

patchFile("node_modules/nitro/dist/vite.mjs", (source) =>
  source.replace("this.meta.rolldownVersion", "this?.meta?.rolldownVersion"),
);

for (const file of [
  "node_modules/@tanstack/start-server-core/dist/esm/createStartHandler.js",
  "node_modules/@tanstack/start-server-core/src/createStartHandler.ts",
]) {
  patchFile(file, (source) =>
    source.replace(
      /const\s*\[matchedRoutes,\s*rawParams,\s*foundRoute\]\s*=\s*router\.getMatchedRoutes\(pathname\)/g,
      "const _mr = router.getMatchedRoutes(pathname); const [matchedRoutes, rawParams, foundRoute] = Array.isArray(_mr) ? _mr : [_mr?.matchedRoutes || [], _mr?.routeParams || {}, _mr?.foundRoute]",
    ),
  );
}

for (const file of [
  "node_modules/@tanstack/react-router/src/Scripts.tsx",
  "node_modules/@tanstack/react-router/dist/esm/Scripts.js",
  "node_modules/@tanstack/react-router/dist/cjs/Scripts.cjs",
]) {
  patchFile(file, (source) =>
    source.replace(
      /router\.serverSsr\.takeBufferedScripts\(\)/g,
      '(typeof router.serverSsr?.takeBufferedScripts === "function" ? router.serverSsr.takeBufferedScripts() : undefined)',
    ),
  );
}

for (const file of [
  "node_modules/@tanstack/router-core/src/ssr/transformStreamWithRouter.ts",
  "node_modules/@tanstack/router-core/dist/esm/ssr/transformStreamWithRouter.js",
  "node_modules/@tanstack/router-core/dist/cjs/ssr/transformStreamWithRouter.cjs",
]) {
  patchFile(file, (source) =>
    source.replace(
      "if (serverSsr.reserveStreamFastPath())",
      'if (typeof serverSsr.reserveStreamFastPath === "function" && serverSsr.reserveStreamFastPath())',
    ),
  );
}
