# Dawn — Morning Routine Planner

## What this app does
A fully client-side React SPA that helps users build a 5:45 AM morning routine. Key features:
- **Bedtime calculator** — picks an in-bed time from sleep hours + fall-asleep buffer
- **Customizable time blocks** — drag-ordered list of morning slots (wake, dog walk, shower, breakfast, exercise, meditation, journal, custom). Mandatory blocks can't be disabled or removed.
- **14-day gradual wake-up plan** — linearly interpolates from current wake time to 5:45 AM in 5-minute steps, keeping sleep duration constant
- **Printable weekly schedule** — a Mon–Fri grid rendered only at print time (`window.print()`)
- **Light/dark theme** — toggled in-app, initialized from `prefers-color-scheme`

No backend, no persistence. All state is in-memory React state that resets on page reload.

## Stack
- **React 18** + TypeScript + Vite
- **Tailwind CSS v3** + shadcn/ui (Radix primitives)
- **wouter** for routing (hash-based via `useHashLocation`)
- **Express** server is scaffolded but unused — the app is 100% static
- **Fonts**: Inter (UI), Fraunces (serif headings), JetBrains Mono (times/numbers)

## Project layout
```
client/src/
  pages/home.tsx        — entire UI; all sections are inline in one component
  lib/planner.ts        — pure time math (no React); bedtime calc, schedule layout, 14-day plan
  lib/theme.tsx         — ThemeProvider + useTheme hook
  lib/queryClient.ts    — TanStack Query client (present but unused by app logic)
  index.css             — dawn palette CSS variables, print styles, dawn-gradient utility
  App.tsx               — providers + wouter router
  components/ui/        — shadcn/ui component library (don't edit these)
server/                 — Express scaffold (unused at runtime for this app)
shared/schema.ts        — Drizzle schema (unused)
```

## Key abstractions (client/src/lib/planner.ts)
- **Times** are stored as "minutes from midnight" (integers 0–1439)
- `fmtTime(min)` → 12-hour string; `fmtTime24(min)` → 24-hour string; `parseTime24(str)` → minutes
- `computeBedtime(wakeMin, sleepHours, buffer)` → bedtime in minutes
- `buildWakePlan(currentWake, targetWake, sleepHours, days, startDate, buffer)` → `WakePlanEntry[]`
- `layoutSchedule(slots, wakeMin)` → `ScheduledSlot[]` (back-to-back, enabled slots only)
- `DEFAULT_SLOTS` — the starting slot list; `fixed: true` slots cannot be toggled/removed
- `TARGET_WAKE_MIN = 345` (5:45 AM)

## Slot color map
Each `SlotKind` maps to a Tailwind color class in `SLOT_COLORS` in `home.tsx`. Add new kinds there and in `SlotKind` union in `planner.ts`.

## State shape (home.tsx)
```ts
sleepHours: number          // 6–10, step 0.25; default 7.5
currentWake: string         // "HH:MM" 24h input; default "07:00"
fallAsleepBuffer: number    // 0–45 min, step 5; default 15
planStartDate: string       // "YYYY-MM-DD"; default today
slots: Slot[]               // ordered list; drives schedule + print
newSlotLabel / newSlotDuration  // add-block form state
```

## Print behavior
- All interactive UI has `className="no-print"` → `display: none` in print media
- `<PrintableWeek>` has `className="print-only"` → hidden on screen, visible at print
- Print CSS targets `@page { size: letter portrait; margin: 0.5in }`

## Commands
```bash
npm run dev     # dev server at http://localhost:5000
npm run build   # static output → dist/public/
npm run check   # tsc type-check
```

## Deploy

### Vercel (primary — git-push deploys)
The project is linked to Vercel via the GitHub repo (`hessnd/daily-planner`).
Every push to `main` triggers a production deployment automatically.

```bash
git push   # → triggers Vercel build → dist/public/ served at vercel.app URL
```

Production URL: https://morning-planner-p9i2hmde0-nick-hess-projects-ec1c7357.vercel.app  
Vercel project: `nick-hess-projects-ec1c7357/morning-planner`  
Config: `vercel.json` (buildCommand, outputDirectory, framework: null)

### Manual / other hosts
```bash
npm run build          # output → dist/public/
netlify deploy --dir=dist/public --prod
# or: upload dist/public/ to any static host
```

## Coding conventions
- Time math belongs in `planner.ts` as pure functions — no React imports there
- UI sections live in `home.tsx`; extract a sub-component only when it needs its own local state or is reused
- Use `data-testid` attributes on interactive elements (pattern: `button-`, `input-`, `slider-`, `switch-`, `text-`, `badge-`, `row-`, `timeline-`, `slot-row-`)
- shadcn/ui components in `components/ui/` are generated — don't edit them manually; re-run `npx shadcn add <component>` to update
- Tailwind classes only — no inline styles except in `<PrintableWeek>` (print layout requires precise pt/in units)
