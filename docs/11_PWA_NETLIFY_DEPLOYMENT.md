# 11. PWA & Deployment Guide

## Progressive Web App (PWA) Setup

### 1. Web App Manifest (`public/manifest.json`)
- **Display Mode**: `standalone` (removes browser URL bars and chrome).
- **Orientation**: `portrait` with adaptive landscape table responsiveness.
- **Theme Color**: `#020e09` (Emerald Dark Felt).
- **Background Color**: `#0c0a09` (Stone 950).
- **Icons**: 192x192 and 512x512 maskable icons.

### 2. Service Worker (`public/sw.js`)
- Caches all static assets, scripts, CSS, fonts, and HTML entry point.
- **Cache-First Strategy** for immutable bundles, ensuring 100% offline gameplay when disconnected.
- Updates automatically on new build deployments.

### 3. In-App Install Prompt (`src/components/pwa/`)
- Listens for browser `beforeinstallprompt` event.
- Displays an unobtrusive install banner allowing users to install Call Break directly to their home screen or desktop launcher.

---

## Deployment & Production Build

### 1. Netlify Configuration (`netlify.toml`)
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### 2. Vite Production Build Workflow
- `npm run build` generates optimized static files in `/dist`:
  - Code splitting and tree shaking.
  - CSS minification via Tailwind.
  - Asset hashing for cache busting.
