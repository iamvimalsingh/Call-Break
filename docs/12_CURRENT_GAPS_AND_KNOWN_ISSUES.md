# 12. Current Gaps & Known Nuances

## Technical Assessment

### 1. Viewport & Device Nuances
- **iOS Safari Dynamic Viewport (`dvh`)**:
  - `GameShell.tsx` uses `h-[100dvh]` to account for Safari's collapsible bottom address bar.
  - On older iOS (<15.4) Safari browsers that lack `dvh` support, fallback to `min-h-screen` ensures full coverage.
- **Ultra-Narrow Android Foldables (Outer screens <320px)**:
  - Outer sub-screens (e.g. Galaxy Z Fold outer display at ~280px) may experience tight card overlap. Cards remain fully legible via suit/rank corners and pop up clearly upon touch.

### 2. Browser Audio Policies
- **Autoplay Restrictions**:
  - Web Audio context is initialized lazily upon the user's first click or touch interaction (`SoundManager.ts`), preventing browser autoplay policy warnings.

### 3. LocalStorage Storage Quotas
- **History Growth**:
  - `historyManager.ts` enforces a cap of the last 100 matches to prevent local storage quota saturation.

### 4. Zero Unresolved Critical Bugs
- All 150 automated test cases and 50-game headless simulations execute with **0 violations**, **0 deadlocks**, and **0 rule errors**.
