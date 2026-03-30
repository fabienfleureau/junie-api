import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  sourcemap: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  env: {
    NODE_ENV: "production",
  },
})
