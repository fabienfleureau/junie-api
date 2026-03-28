# AGENTS.md

## Build, Lint, and Test Commands

- **Build:**
  `bun run build` (uses tsdown)
- **Dev:**
  `bun run dev`
- **Lint:**
  `bun run lint`
- **Start (prod):**
  `bun run start`
- **Typecheck:**
  `bun run typecheck`

## Code Style Guidelines

- **Imports:**
  Use ESNext syntax. Prefer absolute imports via `~/*` for `src/*` (see `tsconfig.json`).
- **Types:**
  Strict TypeScript (`strict: true`). Avoid `any`; use explicit types and interfaces.
- **Naming:**
  Use `camelCase` for variables/functions, `PascalCase` for types/classes.
- **Error Handling:**
  Use explicit error classes (see `src/lib/error.ts`). Avoid silent failures.
- **Modules:**
  Use ESNext modules with `.js` extensions in imports.
