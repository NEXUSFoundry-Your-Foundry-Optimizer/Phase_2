// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function routerCoreClientCompatibility() {
  return {
    name: "router-core-client-compatibility",
    enforce: "pre" as const,
    transform(code: string, id: string, options?: { ssr?: boolean }) {
      if (
        options?.ssr ||
        !id
          .split("?")[0]
          .replaceAll("\\", "/")
          .endsWith("/node_modules/@tanstack/router-core/dist/esm/index.js")
      ) {
        return null;
      }

      return code.replace('export { createRawStreamRPCPlugin } from "./ssr/server.js";', "");
    },
  };
}

export default defineConfig({
  plugins: [routerCoreClientCompatibility()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    spa: {
      enabled: true,
    },
    prerender: {
      enabled: false,
    },
  },
});
