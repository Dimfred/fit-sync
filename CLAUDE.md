# FIT Sync - Sync .fit files to Garmin and other targets

You're my coding assistant, remember these preferences:

- prefer type hints
- always include error handling
- Early return always over nested ifs/callbacks
- Prefer small files over big 500 line monsters
- NEVER auto-invoke any `superpowers:*` skills on your own initiative
- Only invoke a superpowers skill when the user explicitly requests it
- Always use `make` commands over raw commands when a Makefile target exists
- Always use `bun add` to install packages, don't install a specific version
- Don't run build or install commands for me unless mentioned in Makefile targets
- Before we commit, run `make lint-fix`, if not all issues are fixed also run `make lint` and fix the issues
- Never run biome unsafe fix, fix the errors manually
- When using svelte shadcn Select component search the project for how it's used
- shadcn components should always be installed through the cli
- Try to inline lambdas passed to components if they're one or two liners
- When using `<style>` in Svelte components and getting `@tailwindcss/vite` errors, use `<style global>`

## Reference

- Example Tauri app: `~/workspaces/tcg-lightning/tcg-lightning/tcg-lightning-app`
- Garmin Connect API copied from: `~/workspaces/kcalmctrackface/kcalmctrackface-app/src/lib/garmin-connect` (adapted for Tauri: axios → @tauri-apps/plugin-http fetch, React Native → Tauri Store for token storage)

## Stack

- **Frontend**: Tauri v2 + Svelte 5 + SvelteKit (SPA, adapter-static)
- **Styling**: Tailwind CSS v4 with kranq.fit color scheme
- **Storage**: JSON file via @tauri-apps/plugin-store (`app-data.json` in APP_DATA_DIR)
- **Linting**: Biome
- **Package manager**: bun
- **Language**: TypeScript (strict)
- **Target**: macOS first, cross-platform later

## Architecture

- `src/lib/` for shared code (db, services, types, components)
- `src/routes/` for pages
- `src-tauri/` for Rust backend
- Interfaces/types in separate `.types.ts` files
- PascalCase for `.svelte` and `.svelte.ts` files
- kebab-case for `.service.ts` files
