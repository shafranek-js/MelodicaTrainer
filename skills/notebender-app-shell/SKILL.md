---
name: notebender-app-shell
description: NoteBender app shell guidance for routing, Vite configuration, Tailwind styling, navigation, GitHub Pages deployment, React Router routes, notation language switching, and i18n behavior. Use when Codex changes App.tsx, Menu.tsx, NotationSwitch.tsx, i18n.js, styles.css, Vite or TypeScript config, or any cross-route UI shell behavior.
---

# NoteBender App Shell

## Start Here

Use this skill for cross-cutting app work rather than route-specific music logic. Read `AGENTS.md` first if it has not already been loaded, then inspect the files named below before editing.

Key files:

- `src/App.tsx`: route registration, `HashRouter`, lazy MusicXML route, layout container.
- `src/Menu.tsx`: top navigation, notation switch placement, external links, lucide icons.
- `src/NotationSwitch.tsx`: toggles between English note names and solfege display.
- `src/i18n.js`: i18next setup and note-name translations.
- `src/styles.css`: Tailwind 4 import and global OSMD/VexFlow adjustment.
- `vite.config.ts`: Vite React/Tailwind plugins and GitHub Pages base path.
- `package.json`: scripts and dependency surface.

## Routing And Deployment

Preserve `HashRouter` unless the deployment target changes. GitHub Pages refresh behavior depends on hash routes.

Keep the default route pointed at `/harmonica` unless the product flow is intentionally changed. Register new route pages in `src/App.tsx` and add matching navigation in `src/Menu.tsx` when the page should be user-accessible.

Keep `vite.config.ts` base as `/NoteBender/` while deploying to `https://izabala033.github.io/NoteBender/`. Use `import.meta.env.BASE_URL` for public assets so previews and GitHub Pages both work.

## UI Shell Patterns

Keep the shell compact and app-like. Existing pages use dark Tailwind surfaces, simple borders, responsive grids, and direct controls rather than marketing sections.

Use lucide-react icons for new shell icons when an icon is appropriate. Keep external links accessible with `target="_blank"` and `rel="noopener noreferrer"`.

Avoid adding instructional text to the app shell unless it is product content the user explicitly needs.

## i18n And Notation

Use `useTranslation()` for display note names and `t(noteName)` for pitch classes. Missing translation keys intentionally fall back to the key through `parseMissingKeyHandler`.

Only `solfege` translations are configured. English note names are the fallback keys, not a separate resource bundle.

Keep `NotationSwitch` as a lightweight language toggle. If adding more notation modes, update both the resources and the toggle logic together.

## Validation

Run `npm run build` after route, config, i18n, or app shell changes. Run `npm run lint` when touching React components or configuration. Start `npm run dev` for manual navigation checks if UI behavior changed.
