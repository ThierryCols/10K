# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Scoreboard web app for the 10,000 dice game. Lightweight, mobile-first, hosted on GitHub Pages at `ThierryCols/10K`.

## Tech stack

- **Alpine.js** — reactivity via `x-data="scoreboard"` component defined in `src/game.ts`
- **Pico CSS** — classless CSS, imported in `src/main.ts`
- **TypeScript** — compiled by Vite (`tsc` for type checking, Vite for bundling)
- **Vite** — dev server and build tool; `base: '/10K/'` is set for GitHub Pages

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173/10K/
npm run build     # type-check + build to dist/
npm run preview   # preview the production build locally
```

## Architecture

All game logic lives in `src/game.ts` as a plain factory function (`createScoreboard`) registered with `Alpine.data()` in `src/main.ts`. The HTML in `index.html` uses Alpine directives (`x-model`, `x-for`, `x-show`, etc.) directly — no separate component files.

Deployment is fully automated: pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. Enable GitHub Pages in repo settings (Settings → Pages → Source: GitHub Actions) for the first deploy.
