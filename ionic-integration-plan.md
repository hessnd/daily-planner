# Ionic + Capacitor Integration — Final Handoff Plan

**Project**: Dawn Morning Planner  
**Path**: `/Users/nhess/Developer/morning-planner`  
**Date**: 2026-05-03  
**Based on**: ionic-research.md + local-context.md + implementation-strategy.md (synthesized)

---

## Executive Summary

This plan adds `@ionic/react` (v8.x) and Capacitor (v7.x) to the existing Dawn Morning Planner — a fully client-side React 18 + Vite + Tailwind CSS v3 + wouter + shadcn/ui SPA — so it can be packaged as a native iOS and Android app. The integration is strictly additive: the existing UI layer (shadcn/ui, Radix, Tailwind), routing (wouter with hash-based navigation), and state model remain untouched. `@ionic/react-router` is explicitly excluded because `@ionic/react` v8 demands React Router v5 (v6 support is in an unmerged PR targeting Ionic v9), and the app's single route makes the wouter-to-RRv5 migration a dead-end step that would be re-done when Ionic v9 ships. The end state is: `IonApp` wraps the React tree, Ionic's dark palette class is synced alongside the existing `.dark` toggle, CSS imports are ordered so Tailwind's custom properties win, Capacitor is configured with `webDir: "dist/public"`, and `npm run build && npx cap sync` is the deployment pipeline for native.

---

## Key Constraints & Decisions

**Architectural decisions — must not be reversed:**

- **Do NOT install `@ionic/react-router`**. It forces `react-router-dom@^5` as a peer dependency, locks out React Router v6, and provides zero value for a packaging-only integration. Keep `wouter` intact.
- **Do NOT replace shadcn/ui components with Ionic components** (`IonButton`, `IonCard`, `IonInput`, etc.). The UI stays 100% shadcn/ui + Radix + Tailwind.
- **Do NOT modify `client/src/components/ui/`**. These are shadcn/ui generated files; re-run `npx shadcn add <component>` to update them.
- **Do NOT change `vite.config.ts`** `build.outDir`. It stays `dist/public/` — this is the Capacitor `webDir`.
- **Do NOT change the dawn palette CSS variables** in `index.css` (`:root` and `.dark` blocks). Ionic CSS variable tokens are additive alongside them, never replacing them.
- **Do NOT use `dark.system.css` or `dark.always.css`** from Ionic's palettes. Only `dark.class.css` is correct here — it avoids fighting with the manual theme toggle.
- **Do NOT skip `corePlugins: { preflight: false }` in Tailwind config**. Ionic's `core.css` ships its own normalize; Tailwind Preflight on top causes double-reset side-effects.
- **Do NOT add Capacitor native plugins** beyond the four core packaging packages (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`) — until explicitly scoped in a follow-up task.

**Confirmed facts that drive implementation:**

- **Tailwind version is v3 + PostCSS** (confirmed by `postcss.config.js` using `tailwindcss: {}` and `vite.config.ts` having no `@tailwindcss/vite` plugin). The `@tailwindcss/vite ^4.1.18` in `devDependencies` is installed but not wired up — ignore it. CSS uses `@tailwind base/components/utilities` syntax (v3), not `@import "tailwindcss"` (v4).
- **`vite.config.ts`**: `root = "client/"`, `base = "./"`, `build.outDir = "dist/public/"`. Relative asset paths + hash routing = correct for Capacitor's `file://` protocol.
- **Router surface is minimal**: only `App.tsx` uses wouter (two routes, no `Link`/`useLocation`/`useParams` anywhere). Migration to React Router v5 would be a ~10-line diff, but is a dead end — defer until Ionic v9.
- **Theme**: `theme.tsx` line 14–17 adds/removes `.dark` on `document.documentElement`. Must also sync `.ion-palette-dark` to the same element.
- **Print feature**: `window.print()` is a no-op inside Capacitor WebView on iOS/Android. Hide the print button on native using `Capacitor.isNativePlatform()`.
- **`IonApp` sets `position: fixed; height: 100%`** on `<ion-app>`. Add `@media print { ion-app { position: static !important; height: auto !important; overflow: visible !important; } }` to prevent print layout breakage.
- **`PrintableWeek` must NOT be inside `IonContent`** (which uses `overflow: auto` and may clip at print time). Place it as a direct child of `IonApp`, outside the main content scroll area.
- **`client/index.html` viewport meta** needs `viewport-fit=cover` for iOS notch / safe-area support.

---

## Phase Plan

### Phase 0 — Pre-flight Verification (15 min)

**Goal**: Confirm the build pipeline is healthy before touching anything.

**Steps**:
1. From project root, confirm clean build:
   ```bash
   node --version   # verify Node ≥ 18 (Capacitor 6+ minimum; Capacitor 7 may require higher — check release notes)
   npm run check    # must pass with zero TypeScript errors
   npm run build    # must succeed; dist/public/index.html must exist
   ```
2. Confirm Tailwind v3 PostCSS pipeline is active (not v4 Vite plugin):
   - `postcss.config.js` uses `tailwindcss: {}` ✅ (already confirmed)
   - `vite.config.ts` has no `@tailwindcss/vite` import in plugins ✅ (already confirmed)
   - `index.css` uses `@tailwind base/components/utilities` ✅ (already confirmed)
   - The `@tailwindcss/vite ^4.1.18` in devDependencies is inert — do not activate it.
3. Run `npm run dev` and confirm app loads at `http://localhost:5000`, both light and dark modes work, and all shadcn/ui components are functional.

**Rollback**: Nothing changed yet. If the build was already broken, file a bug before proceeding.

---

### Phase 1 — Install `@ionic/react` + CSS Reconciliation

**Goal**: `@ionic/react` is installed, `IonApp` wraps the React tree, and the visual appearance is pixel-for-pixel identical to Phase 0 on desktop web. Tailwind classes and dawn palette CSS variables must be unaffected.

#### Files to modify:
- `client/src/index.css` — add Ionic CSS imports
- `tailwind.config.ts` — disable Preflight
- `client/src/App.tsx` — add `setupIonicReact()` and `<IonApp>` wrapper
- `client/index.html` — update viewport meta

#### Step 1.1 — Install the package

```bash
# From project root:
npm install @ionic/react
# Confirm installation:
npm ls @ionic/react   # expect @ionic/react@8.x.x
# Confirm @ionic/react-router was NOT installed:
npm ls @ionic/react-router   # should show nothing / error
```

#### Step 1.2 — Update `client/src/index.css`

Add the following at the **very top of the file**, before the existing Google Fonts `@import`:

```css
/* ─── Ionic Core CSS (required) ─────────────────────────────────────────── */
@import "@ionic/react/css/core.css";

/* ─── Ionic Dark Palette — class-controlled (.ion-palette-dark on <html>) ── */
/* Do NOT use dark.system.css (conflicts with manual toggle) */
/* Do NOT use dark.always.css (forces dark permanently) */
@import "@ionic/react/css/palettes/dark.class.css";

/* ─── Print layout fix: IonApp's position:fixed breaks @media print ──────── */
/* (This block lives at the top level, not inside @layer base) */
```

Then, directly below the two `@import` lines for Ionic but before the Google Fonts `@import`, add the `ion-app` print fix as a plain CSS rule (NOT inside any `@layer`):

```css
@media print {
  ion-app {
    position: static !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
}
```

Then add the Ionic ↔ Dawn palette bridge variables inside the existing `:root` block in `index.css`. Locate the `:root {` block and add these two lines at the top of it:

```css
:root {
  /* ─── Ionic color bridge: bind --ion-* to dawn palette tokens ── */
  --ion-background-color: hsl(var(--background));
  --ion-text-color: hsl(var(--foreground));
  --ion-font-family: var(--font-sans);
  /* ... rest of existing :root properties ... */
}
```

Similarly, inside the existing `.dark {` block, add the same bridge variables:

```css
.dark {
  /* ─── Ionic dark color bridge ── */
  --ion-background-color: hsl(var(--background));
  --ion-text-color: hsl(var(--foreground));
  /* ... rest of existing .dark properties ... */
}
```

**Final import order at the top of `index.css` must be**:
```
1. @import "@ionic/react/css/core.css";
2. @import "@ionic/react/css/palettes/dark.class.css";
3. @import url('https://fonts.googleapis.com/...');   ← existing (MUST stay grouped with @imports)
4. @media print { ion-app { ... } }     ← plain rule AFTER all @imports, not in @layer
5. @tailwind base;                                    ← existing
6. @tailwind components;                              ← existing
7. @tailwind utilities;                               ← existing
```

> ⚠️ **CSS spec rule**: All `@import` statements must appear before any non-import rules (like `@media`). If the Google Fonts `@import` appears after the `@media print` block, browsers silently ignore it — Inter, Fraunces, and JetBrains Mono all break with **no console error**.

**Do NOT import these Ionic stylesheets** (all conflict with existing app):
- `normalize.css` — already included inside `core.css`
- `structure.css` — sets `body { position: fixed; overflow: hidden }` which breaks web scrolling
- `typography.css` — overrides `html` font-family, defeating Inter font setup
- `text-alignment.css`, `text-transformation.css`, `flex-utils.css`, `display.css` — redundant with Tailwind

#### Step 1.3 — Disable Tailwind Preflight

In `tailwind.config.ts`, add `corePlugins` at the top level:

```typescript
export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    preflight: false,   // ← ADD THIS LINE
  },
  theme: {
    extend: {
      // ... existing theme config, unchanged ...
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
```

**Why safe**: Ionic's `core.css` provides its own normalize (box-sizing, margin resets, form element normalization). The app's `@layer base { * { @apply border-border } }` and `@layer base { body { @apply font-sans antialiased bg-background text-foreground } }` are **not** part of Preflight — they will continue to run.

> ⚠️ **Preflight regression risk**: shadcn/ui components silently depend on some Preflight resets that Ionic's `core.css` does **not** fully replicate — e.g. `img { display: block }`, `svg { display: inline-block }`, `button { background-color: transparent; padding: 0 }`. After Phase 1, specifically test: `Button`, `Input`, `Slider`, `Switch`, `Select`, `Badge`, and `Separator`. If any show visual regressions, add targeted resets in `@layer base` in `index.css` (do **not** re-enable full Preflight, as that reintroduces the Ionic double-reset conflict).

#### Step 1.4 — Add `setupIonicReact()` and `<IonApp>` wrapper to `client/src/App.tsx`

Replace the current `App.tsx` with:

```tsx
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { IonApp, setupIonicReact } from "@ionic/react";          // ← NEW
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { ThemeProvider } from "@/lib/theme";

setupIonicReact();   // ← NEW: must be called at module level before any Ionic component renders

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <IonApp>                              {/* ← NEW wrapper */}
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </IonApp>                             {/* ← NEW wrapper */}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
```

**Note**: `IonApp` is placed inside `TooltipProvider` (not outside) so that Radix `TooltipProvider` is still an ancestor of everything. If `IonApp` needs to be the outermost DOM element (which it does), this ordering is fine because `QueryClientProvider`, `ThemeProvider`, and `TooltipProvider` are React context providers — they don't add DOM elements. The rendered DOM will have `<ion-app>` as the outermost real DOM element inside `#root`.

#### Step 1.5 — Update `client/index.html` viewport meta

Replace the existing viewport meta tag:
```html
<!-- OLD: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />

<!-- NEW: -->
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

The `viewport-fit=cover` is required for Capacitor/iOS safe-area inset support (`env(safe-area-inset-*)` CSS variables).

#### Phase 1 Validation

```bash
npm run check     # TypeScript must pass — zero errors
npm run build     # Vite build must succeed; dist/public/ must be populated
npm run dev       # then open http://localhost:5000
```

Visual checks in browser (localhost:5000):
- [ ] `<ion-app>` element present in DOM (inspect element on `#root`'s first child)
- [ ] Light mode: dawn palette colors correct (`bg-primary` = deep blue/purple, `bg-card` = warm cream)
- [ ] Dark mode toggle: both `.dark` AND `.ion-palette-dark` present on `<html>` (verify in DevTools)
- [ ] Dark mode: dark palette colors correct (deep dark blue background)
- [ ] Dawn gradient header renders in both themes
- [ ] All shadcn/ui components render and function: Slider, Switch, Card, Button, Badge, Input
- [ ] Bedtime calculator updates correctly
- [ ] Slot list drag-order and toggle work
- [ ] Print preview (`Ctrl+P`): only the weekly schedule grid visible; all interactive UI hidden
- [ ] `.no-print` class hides header and sections at print time
- [ ] `.print-only` class shows `PrintableWeek` only at print time
- [ ] Console: zero errors, zero warnings about Ionic CSS not found
- [ ] No layout breakage: full page scrollable, content not clipped

#### Phase 1 Rollback

```bash
git restore client/src/index.css tailwind.config.ts client/src/App.tsx client/index.html
npm uninstall @ionic/react
```

---

### Phase 2 — Dark Mode Coexistence

**Goal**: The app's existing `ThemeProvider` syncs the Ionic dark palette class alongside the Tailwind `.dark` class, so Ionic components (currently just `IonApp`'s background color) respond to the app's theme toggle.

**This phase touches one file only**: `client/src/lib/theme.tsx`

#### Files to modify:
- `client/src/lib/theme.tsx`

#### Step 2.1 — Sync `.ion-palette-dark` in ThemeProvider

Replace the `useEffect` in `ThemeProvider` (lines 13–17 of the current file):

```typescript
useEffect(() => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.add("ion-palette-dark");    // ← NEW: sync Ionic dark palette
  } else {
    root.classList.remove("dark");
    root.classList.remove("ion-palette-dark"); // ← NEW: remove Ionic dark palette
  }
}, [theme]);
```

**Why this works**:
- Tailwind dark variants (`dark:bg-slate-900`) activate via `.dark` on `<html>` — unchanged ✅
- Ionic's `dark.class.css` (imported in Phase 1) applies its `--ion-*` dark overrides when `.ion-palette-dark` is present on `<html>` ✅
- Both class mutations happen synchronously in the same effect — no flash of incorrect theme ✅
- The dawn palette `--background`, `--foreground`, etc. are **not overridden** by Ionic's dark palette (different CSS variable names: `--ion-background-color` vs `--background`). The Phase 1 bridge variables (`--ion-background-color: hsl(var(--background))`) ensure `IonApp`'s own background matches the dawn palette in both modes ✅

#### Phase 2 Validation

In browser (localhost:5000):
- [ ] Click theme toggle: `<html>` gains both `.dark` and `.ion-palette-dark` (verify in DevTools Elements)
- [ ] Click theme toggle again: both classes removed
- [ ] `IonApp` background in dark mode matches the dark dawn background (dark navy, not Ionic's default dark gray)
- [ ] `IonApp` background in light mode matches the light dawn background (warm cream)
- [ ] Page refresh in dark mode: system preference is correctly detected; `.ion-palette-dark` applied at load (because `useState` initializer reads `prefers-color-scheme`)

#### Phase 2 Rollback

```bash
git restore client/src/lib/theme.tsx
```

---

### Phase 3 — Router Migration: wouter → React Router v5 + `@ionic/react-router`

> ⚠️ **DEFERRED — STRONGLY RECOMMENDED TO SKIP UNTIL IONIC v9 SHIPS**

**Background**: All three research streams are unanimous. `@ionic/react-router` v8 requires `react-router-dom@^5`. React Router v5 is in maintenance mode. Ionic's React Router v6 support (PR #30831 targeting `major-9.0` branch) had not merged as of May 2026. For a packaging-only integration (no native swipe-back, no `IonRouterOutlet` transitions), router migration provides zero user-visible benefit.

**Trigger to un-defer**: When `@ionic/react` v9 ships with React Router 6 support confirmed in release notes. At that point, **skip v5 entirely and migrate directly to React Router 6**.

**If pursued NOW (wouter → React Router v5 only)**:

Files requiring changes:
- `client/src/App.tsx` — replace `Router + wouter` with `HashRouter` from `react-router-dom`
- `client/src/main.tsx` — remove `window.location.hash = "#/"` bootstrap (HashRouter normalizes this)
- `package.json` — add `react-router-dom@^5.3.4`, remove `wouter`

Migration map:

| Current (wouter) | Replace with (RRv5) | Notes |
|---|---|---|
| `import { Switch, Route, Router } from "wouter"` | `import { HashRouter, Switch, Route } from "react-router-dom"` | RRv5 `Switch`/`Route` API is identical |
| `import { useHashLocation } from "wouter/use-hash-location"` | _(remove)_ | `HashRouter` handles hash navigation |
| `<Router hook={useHashLocation}>` | `<IonReactHashRouter>` (if using `@ionic/react-router`) or `<HashRouter>` (wouter-only) | |
| `<Route path="/" component={Home} />` | `<Route exact path="/" component={Home} />` | RRv5 requires `exact` |
| `<Route component={NotFound} />` | `<Route component={NotFound} />` | Same — catch-all in Switch |

**Install commands (if pursued)**:
```bash
npm install @ionic/react-router react-router@5 react-router-dom@5
npm install --save-dev @types/react-router-dom
npm uninstall wouter
```

**Phase 3 Validation** (if pursued):
- [ ] `npm run check` passes
- [ ] Home page loads at `#/`
- [ ] NotFound renders for `#/unknown`
- [ ] No `react-router-dom` version conflicts in `npm ls`

---

### Phase 4 — Capacitor Setup

**Goal**: Native iOS and Android Xcode/Android Studio projects exist, the Vite build output is synced into them, and the app runs in a simulator/emulator.

#### Files to create:
- `capacitor.config.ts` (NEW at project root)

#### Files to modify:
- `package.json` — add convenience scripts

#### Step 4.1 — Install Capacitor packages

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

Verify versions:
```bash
npm ls @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
# All should be 7.x.x (matching versions)
```

#### Step 4.2 — Initialize Capacitor

```bash
# From project root (where package.json lives — NOT inside client/):
npx cap init "Dawn" "com.dawn.morningplanner"
```

> ⚠️ The `--web-dir` CLI flag is not reliably supported in Capacitor 7 — omit it. The questionnaire will ask for the web directory; answer `dist/public`. Alternatively, run without answering and immediately correct the generated file.

This creates `capacitor.config.ts`. **Immediately verify** `webDir` is `dist/public` — the CLI often defaults to `dist` or `build`. Correct it if needed. Final contents:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dawn.morningplanner',
  appName: 'Dawn',
  webDir: 'dist/public',        // ← CRITICAL: must match vite.config.ts build.outDir
  // bundledWebRuntime was removed in Capacitor 6+ — do NOT add this field
  server: {
    // For Capacitor live reload during development, uncomment and fill in:
    // url: 'http://YOUR_LOCAL_IP:5000',
    // cleartext: true,
  },
};

export default config;
```

> ⚠️ The `server.url` block must remain commented out for production builds. It is only for live-reload development.

#### Step 4.3 — Build web assets

```bash
npm run build
# Verify: dist/public/index.html must exist
ls dist/public/index.html
```

#### Step 4.4 — Add native platforms

```bash
npx cap add ios
npx cap add android
```

These create `ios/` and `android/` directories. Both are generated — do not hand-edit native project files unless Capacitor documentation explicitly instructs it.

#### Step 4.5 — Add convenience scripts to `package.json`

In the `"scripts"` section of `package.json`, add:

```json
"cap:build": "npm run build && npx cap sync",
"cap:ios": "npm run cap:build && npx cap open ios",
"cap:android": "npm run cap:build && npx cap open android",
"cap:sync": "npx cap sync"
```

#### Phase 4 Validation

```bash
npm run check            # TypeScript clean
npm run build            # dist/public/ populated
npx cap sync             # must complete without errors
```

Native simulator validation (requires macOS + Xcode for iOS, Android Studio for Android):
```bash
npx cap open ios         # opens Xcode — build and run in simulator
npx cap open android     # opens Android Studio — build and run in emulator
```

Simulator checks:
- [ ] App loads — no white screen (validates `webDir` and `base: "./"` relative paths)
- [ ] Home page content renders correctly
- [ ] Hash routing: deep-linking to `#/` works
- [ ] No content obscured by notch/status bar on iPhone 14 Pro (validates viewport-fit=cover)
- [ ] No content obscured by home indicator on iPhone
- [ ] Touch events work on Slider, Switch, Button, Input
- [ ] Theme toggle works on device
- [ ] Print button visible on web, hidden on native (Phase 4.6 below)

#### Step 4.6 — Hide print button on native platform

In `client/src/pages/home.tsx`, add a platform check for the print CTA. This requires importing Capacitor:

```typescript
import { Capacitor } from '@capacitor/core';
```

Then in the JSX where the print button is rendered (search for `handlePrint` or `window.print`), wrap with a conditional:

```tsx
{!Capacitor.isNativePlatform() && (
  <Button onClick={handlePrint} ...>
    Print Weekly Schedule
  </Button>
)}
```

This hides the print button entirely on iOS/Android where `window.print()` is a no-op, while preserving it on desktop web.

#### Phase 4 Rollback

```bash
git restore package.json
rm capacitor.config.ts
rm -rf ios/ android/
npm uninstall @capacitor/core @capacitor/ios @capacitor/android
npm uninstall -D @capacitor/cli
```

---

### Phase 5 — Build & Sync Workflow

**Goal**: The team has a clear, repeatable workflow for building and deploying to native.

#### Standard development → device workflow

```bash
# 1. Web development (unchanged):
npm run dev                     # http://localhost:5000

# 2. Native build:
npm run build                   # compile web assets to dist/public/
npx cap sync                    # copy dist/public/ into ios/ and android/ projects

# 3. Open native IDE:
npx cap open ios                # Xcode (macOS only)
npx cap open android            # Android Studio (any OS)
# Then build & run in IDE as normal

# 4. Or use the convenience scripts:
npm run cap:ios                 # build + sync + open Xcode
npm run cap:android             # build + sync + open Android Studio
```

#### Capacitor live reload (development with hot-reload on device)

1. Find your local IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
2. Temporarily uncomment in `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'http://192.168.X.X:5000',   // replace with your IP
     cleartext: true,
   },
   ```
3. Run dev server and sync:
   ```bash
   npm run dev &
   npx cap sync
   npx cap open ios   # or android
   ```
4. **Before any release/production build**: comment out `server.url` again. Never commit it uncommented.

#### Web-only static deploy (unchanged)

```bash
npm run build
vercel deploy dist/public --prod
# or
netlify deploy --dir=dist/public --prod
```

#### Phase 5 Validation

```bash
npm run cap:build    # must succeed end-to-end
```

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Ionic `structure.css` body layout** — `body { position: fixed; overflow: hidden }` breaks web scrolling entirely | CRITICAL | Skip `structure.css` entirely — not imported in this plan. Ionic components work without it when not using `IonPage`/`IonContent`. |
| **Tailwind v4 plugin conflict** — `@tailwindcss/vite ^4.1.18` is in devDependencies but inert | HIGH | Already resolved: `postcss.config.js` drives Tailwind v3 via PostCSS. The v4 plugin is never activated. Do NOT add `@tailwindcss/vite` to `vite.config.ts` plugins. |
| **Ionic Preflight + Tailwind Preflight double-reset** | HIGH | Resolved by `corePlugins: { preflight: false }` in `tailwind.config.ts` (Phase 1). |
| **`IonApp` `position: fixed` breaks `@media print` layout** | HIGH | Resolved by `@media print { ion-app { position: static !important } }` in `index.css` (Phase 1). |
| **Dark mode desync: `.dark` vs `.ion-palette-dark`** | HIGH | Resolved by syncing both classes in `ThemeProvider` `useEffect` (Phase 2). |
| **`@ionic/react-router` peer dep forces React Router v5** | HIGH | Resolved by not installing `@ionic/react-router`. Wouter stays. |
| **`Capacitor.webDir` defaulting to wrong path** | HIGH | Do NOT use `--web-dir` flag (unreliable in Cap 7). Run `npx cap init` without it, then immediately verify and correct `webDir: 'dist/public'` in `capacitor.config.ts`. |
| **`PrintableWeek` inside `IonContent` clipped at print** | MEDIUM | `PrintableWeek` is not placed inside any `IonContent` — it renders directly inside `IonApp` via the `Home` component which is NOT wrapped in `IonPage`/`IonContent`. |
| **`window.print()` is a no-op on native** | MEDIUM | Resolved: hide print button behind `Capacitor.isNativePlatform()` check (Phase 4.6). |
| **Radix portal z-index vs Ionic overlays** | MEDIUM | Ionic overlays use `z-index: 20000+`. shadcn/ui uses z-index 50 by default. Test `Select`, `Popover`, `Tooltip` on device; add CSS overrides if z-index conflicts appear. Low probability since no Ionic overlays are being used. |
| **Google Fonts network request fails on native** | LOW | Fonts are loaded from Google CDN. On device without internet, falls back to system fonts. Acceptable for current scope; self-hosting fonts is a future enhancement. |
| **`ios/` and `android/` require dev tool versions** | LOW | Capacitor 7 requires: Xcode 16+, Android Studio 2024.x+, JDK via Android Studio bundle. Node version minimum: verify against Cap 7 release notes (Cap 6 required Node 18+). Check with `node --version`, `xcodebuild -version`. |
| **`@tailwindcss/vite` v4 accidentally activated** | LOW | Guard: never add `import tailwindcss from '@tailwindcss/vite'` to `vite.config.ts`. The v4 plugin uses `@import "tailwindcss"` syntax (not `@tailwind base/components/utilities`). If v4 is accidentally activated, `index.css` will need full syntax rewrite. |
| **Ionic v9 not yet released** — native transitions deferred | LOW (accepted) | Track https://github.com/ionic-team/ionic-framework/releases. When v9 ships, migrate directly to React Router 6 (skip v5). |

---

## Non-Goals

The following are explicitly **out of scope** for this integration plan:

1. **No `@ionic/react-router` installation** — zero native Ionic page transitions, swipe-back gestures, or `IonRouterOutlet`. Deferred to Ionic v9.
2. **No Ionic UI component adoption** — `IonButton`, `IonCard`, `IonInput`, `IonToggle`, `IonRange`, etc. are not used. The UI stays 100% shadcn/ui + Radix + Tailwind.
3. **No backend changes** — Express server scaffold stays untouched. Capacitor bypasses it entirely.
4. **No persistent state** — state resets on reload as before. No `@capacitor/preferences`, `@capacitor/storage`, or similar.
5. **No Capacitor native plugins** beyond `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` — no push notifications, camera, filesystem, biometrics, in-app purchases, etc.
6. **No change to the dawn palette CSS variables** — `--background`, `--foreground`, `--primary`, etc. remain the canonical color tokens.
7. **No Tailwind configuration changes** beyond adding `corePlugins: { preflight: false }`.
8. **No changes to `vite.config.ts`** — the Vite build config is already correct for Capacitor.
9. **No `shadcn/ui` component regeneration** — Phase 1 does not require updating any Radix components.
10. **No Ionic theming variables as source of truth** — `--ion-background-color`, `--ion-color-primary`, etc. are mapped TO dawn variables, not the other way around.
11. **No server-side rendering** — the app remains 100% static client-side.
12. **No wouter removal** — hash-based routing with wouter stays intact until Ionic v9 is released.

---

## Validation Checklist

### Pre-merge: web functionality must be unbroken

- [ ] `npm run check` — zero TypeScript errors
- [ ] `npm run build` — Vite build succeeds, `dist/public/index.html` exists
- [ ] `npm run dev` — app loads at `http://localhost:5000`
- [ ] `<ion-app>` element present in DOM as outermost element inside `#root`
- [ ] Light mode: dawn palette colors correct (warm cream background, navy primary)
- [ ] Dark mode toggle: `.dark` AND `.ion-palette-dark` both on `<html>` element
- [ ] Dark mode: dark navy background, correct foreground text color
- [ ] Dawn gradient header: renders in both themes with correct gradient
- [ ] Bedtime calculator: sleep hours slider, wake time input, and bedtime calculation all work
- [ ] Slot list: toggle, reorder, add, remove slots — all work
- [ ] 14-day plan table: renders correct dates and times
- [ ] All shadcn/ui components (Slider, Switch, Card, Badge, Input, Label, Button, Separator) render and are interactive
- [ ] Print preview (`Ctrl+P` or `Cmd+P`): only the weekly schedule grid is visible; all `.no-print` sections are hidden
- [ ] Browser console: zero errors

### Post-Capacitor: native app functionality

- [ ] `capacitor.config.ts` exists at project root with `webDir: "dist/public"`
- [ ] `ios/` directory created, valid Xcode project opens with `npx cap open ios`
- [ ] `android/` directory created, valid Android Studio project opens with `npx cap open android`
- [ ] `npx cap sync` completes without errors after `npm run build`
- [ ] App loads in iOS Simulator — no white screen, content renders
- [ ] App loads in Android Emulator — no white screen, content renders
- [ ] Hash routing works: `#/` loads Home, unknown hash shows NotFound
- [ ] No content obscured by iPhone notch/status bar (safe area respected)
- [ ] No content obscured by iPhone home indicator
- [ ] Touch events work: Slider drag, Switch toggle, Button tap, Input focus
- [ ] Theme toggle works on device (both classes toggled)
- [ ] Print button NOT visible on native device (Capacitor.isNativePlatform() check active)
- [ ] App survives backgrounding and returning to foreground without crash

---

## Implementation-Ready Meta-Prompt

```
You are an implementation worker. Your task is to integrate Ionic Framework + Capacitor into the Dawn Morning Planner app at /Users/nhess/Developer/morning-planner.

## Approved Scope
- Install @ionic/react (v8.x) and Capacitor (v7.x)
- Wrap app with IonApp, add setupIonicReact()
- Reconcile CSS: add Ionic imports, disable Tailwind Preflight, fix print layout
- Sync dark mode: add .ion-palette-dark to ThemeProvider alongside .dark
- Configure Capacitor with webDir: "dist/public", add iOS + Android platforms
- Hide print button on native platform

## Project Facts (pre-confirmed, do not re-verify)
- Tailwind is v3 + PostCSS (postcss.config.js: `tailwindcss: {}`). The @tailwindcss/vite v4 entry in devDependencies is INERT — do NOT activate it.
- vite.config.ts: root="client/", base="./", build.outDir="dist/public/"
- Routing: wouter v3.3.5 with hash navigation. Two routes only (/ and catch-all). Zero Link/useLocation/useParams usage.
- ThemeProvider in client/src/lib/theme.tsx adds/removes .dark on document.documentElement.
- darkMode: ["class"] in tailwind.config.ts.

## Hard Constraints
1. Do NOT install @ionic/react-router (forces react-router-dom@5 peer dep — dead end before Ionic v9)
2. Do NOT modify client/src/components/ui/ (shadcn/ui generated files)
3. Do NOT change vite.config.ts build.outDir (stays dist/public/)
4. Do NOT change dawn palette CSS variables in index.css (:root and .dark blocks)
5. Do NOT import Ionic's structure.css, typography.css, or normalize.css
6. Do NOT use dark.system.css or dark.always.css (only dark.class.css)
7. Do NOT add server.url to capacitor.config.ts in committed code (dev-only, comment it out)

## Phase Order
1. Phase 0: Verify clean build (npm run check && npm run build)
2. Phase 1: Install @ionic/react, update index.css, update tailwind.config.ts, update App.tsx, update client/index.html
3. Phase 2: Update theme.tsx to sync .ion-palette-dark
4. Phase 3: SKIP (router migration deferred to Ionic v9)
5. Phase 4: Install @capacitor/core/cli/ios/android, npx cap init, npm run build, npx cap add ios/android, hide print button on native
6. Phase 5: Add cap:build/cap:ios/cap:android scripts to package.json

## Files to Touch
- client/src/index.css — add @import @ionic/react/css/core.css, dark.class.css; add @media print ion-app fix; add --ion-background-color/text-color bridge in :root and .dark
- tailwind.config.ts — add corePlugins: { preflight: false }
- client/src/App.tsx — add setupIonicReact(), import IonApp, wrap content with <IonApp>
- client/src/lib/theme.tsx — add root.classList.add/remove("ion-palette-dark") in useEffect
- client/index.html — update viewport meta to include viewport-fit=cover
- capacitor.config.ts — NEW file at project root
- package.json — add cap:build, cap:ios, cap:android, cap:sync scripts
- client/src/pages/home.tsx — add Capacitor.isNativePlatform() guard on print button

## Install Commands
npm install @ionic/react
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/ios @capacitor/android

## Capacitor Init
# Run from project root (where package.json lives — NOT inside client/)
npx cap init "Dawn" "com.dawn.morningplanner"
# --web-dir flag omitted: unreliable in Cap 7. Answer 'dist/public' when prompted, OR correct the generated capacitor.config.ts immediately after
# Verify capacitor.config.ts has webDir: "dist/public" — correct it if the CLI defaulted to "dist" or "build"
# Do NOT add bundledWebRuntime field — removed in Capacitor 6+
npm run build
npx cap add ios
npx cap add android
npx cap sync

## Validation (run in order)
npm run check           # must pass with zero TypeScript errors
npm run build           # dist/public/index.html must exist
npm run dev             # open localhost:5000, verify visual correctness
npx cap sync            # must succeed

## Escalation Rules
- If `npm install @ionic/react` produces peer dep errors about react-router-dom: do NOT use --legacy-peer-deps. Investigate and escalate.
- If IonApp causes full-page content to disappear or overflow: stop and escalate — do not attempt workarounds to IonApp's position:fixed before consultation.
- If `npx cap add ios` fails due to missing Xcode or CocoaPods: document the missing tool and stop. Do not attempt workarounds.
- If the build fails because @tailwindcss/vite v4 conflicts with Tailwind v3 CSS syntax: escalate — this requires a separate migration decision, not a quick fix.
- If TypeScript errors appear in @ionic/react types: check that @types/react is ^18.x and that the @ionic/react version is compatible.

## Do Not Do
- Do not run npx ionic, npm install -g @ionic/cli, or use the Ionic CLI scaffolding
- Do not install framer-motion (already in dependencies), react-spring, or other animation libs
- Do not add @capacitor/status-bar or @capacitor/splash-screen (Phase 4 optional enhancements, out of current scope)
- Do not create a separate dev/prod capacitor config — a commented-out server.url block in the main config is sufficient
```
