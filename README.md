# Dawn — Morning Routine Planner

Interactive 5:45 AM morning routine planner with bedtime calculator, customizable time blocks, 14-day gradual wake-up shift, and a printable weekly schedule.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui
- Express (template scaffold; no API routes are used — the app is fully client-side)

## Run locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:5000`.

## Build

```bash
npm run build
```

- Static frontend → `dist/public/`
- Server bundle → `dist/index.cjs` (unused for this app)

## Deploy

Since the app is fully static, you can host `dist/public/` on any static host:

- **Vercel:** `vercel deploy dist/public --prod`
- **Netlify:** drop `dist/public/` into the deploy UI, or `netlify deploy --dir=dist/public --prod`
- **Cloudflare Pages, GitHub Pages, S3, etc.:** upload the contents of `dist/public/`

## Project layout

```
client/src/
  pages/home.tsx      ← entire UI (single page)
  lib/planner.ts      ← time math: bedtime calc, layout, 14-day plan
  lib/theme.tsx       ← light/dark mode provider
  index.css           ← dawn palette + print styles
```

All persistent state is in-memory React state — no localStorage, no database.
