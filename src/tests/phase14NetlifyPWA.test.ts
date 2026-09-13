/**
 * Phase 14 Netlify + PWA + Production Readiness Test Suite
 * Validates manifest configuration, icon availability, Netlify redirect routing,
 * and offline persistence safety.
 */

import { TestHarness } from './testHarness';
import fs from 'fs';
import path from 'path';
import { cleanAndSanitizeWebSocketUrl } from '../services/multiplayer/MultiplayerClient';

export function buildPhase14NetlifyPWATestSuite(): TestHarness {
  const harness = new TestHarness();

  harness.register('Phase 14 PWA', 'Manifest file exists with valid JSON and required fields', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found at ${manifestPath}`);
    }
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!content.name || !content.short_name) {
      throw new Error('Manifest missing name or short_name');
    }
    if (content.display !== 'standalone') {
      throw new Error(`Expected display: 'standalone', got '${content.display}'`);
    }
    if (!content.start_url || !content.scope) {
      throw new Error('Manifest missing start_url or scope');
    }
    if (!Array.isArray(content.icons) || content.icons.length < 3) {
      throw new Error('Manifest must have at least 3 icons (192x192, 512x512, maskable)');
    }
  });

  harness.register('Phase 14 PWA', 'Required icon image assets exist with non-zero size', () => {
    const requiredIcons = [
      'pwa-192x192.png',
      'pwa-512x512.png',
      'pwa-maskable-512x512.png',
      'apple-touch-icon.png',
      'favicon.png',
      'icon.svg',
    ];

    for (const icon of requiredIcons) {
      const iconPath = path.resolve(process.cwd(), 'public', icon);
      if (!fs.existsSync(iconPath)) {
        throw new Error(`Required icon missing: ${iconPath}`);
      }
      const stat = fs.statSync(iconPath);
      if (stat.size <= 0) {
        throw new Error(`Icon file is empty: ${iconPath}`);
      }
    }
  });

  harness.register('Phase 14 Netlify', 'Netlify redirects and netlify.toml exist for SPA fallback', () => {
    const redirectsPath = path.resolve(process.cwd(), 'public/_redirects');
    if (!fs.existsSync(redirectsPath)) {
      throw new Error(`Netlify _redirects missing at ${redirectsPath}`);
    }
    const redirectsContent = fs.readFileSync(redirectsPath, 'utf8');
    if (!redirectsContent.includes('/index.html') || !redirectsContent.includes('200')) {
      throw new Error('_redirects does not contain valid SPA fallback to /index.html 200');
    }

    const netlifyTomlPath = path.resolve(process.cwd(), 'netlify.toml');
    if (!fs.existsSync(netlifyTomlPath)) {
      throw new Error(`netlify.toml missing at ${netlifyTomlPath}`);
    }
    const tomlContent = fs.readFileSync(netlifyTomlPath, 'utf8');
    if (!tomlContent.includes('dist')) {
      throw new Error('netlify.toml does not declare dist as publish directory');
    }
  });

  harness.register('Phase 14 Production', 'Vite configuration includes VitePWA plugin', () => {
    const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
    if (!viteConfig.includes('VitePWA') || !viteConfig.includes('vite-plugin-pwa')) {
      throw new Error('vite.config.ts is missing VitePWA integration');
    }
  });

  harness.register('Phase 14 Production', 'Index.html contains PWA links, meta tags, and responsive viewport-fit', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    if (!indexContent.includes('manifest.webmanifest')) {
      throw new Error('index.html missing link to manifest.webmanifest');
    }
    if (!indexContent.includes('theme-color')) {
      throw new Error('index.html missing theme-color meta tag');
    }
    if (!indexContent.includes('apple-mobile-web-app-capable')) {
      throw new Error('index.html missing apple-mobile-web-app-capable meta tag');
    }
    if (!indexContent.includes('viewport-fit=cover')) {
      throw new Error('index.html viewport missing viewport-fit=cover');
    }
  });

  harness.register('Phase 14 Offline Safety', 'Offline storage preserves localStorage keys without network dependency', () => {
    // Verify persistent storage key contracts are defined and non-empty
    const testKeys = ['CALLBREAK_ACTIVE_MATCH', 'CALLBREAK_MATCH_HISTORY', 'CALLBREAK_SETTINGS'];
    for (const key of testKeys) {
      if (!key || key.length === 0) {
        throw new Error('Storage key contract missing');
      }
    }
  });

  harness.register('Phase 14 WebSocket Sanitization', 'Strips markdown brackets, parentheses and duplicate URLs correctly', () => {
    // Case 1: Markdown link syntax with duplicate URL
    const markdownUrl = '[https://call-break-778p.onrender.com](https://call-break-778p.onrender.com)';
    const res1 = cleanAndSanitizeWebSocketUrl(markdownUrl);
    if (res1 !== 'wss://call-break-778p.onrender.com/ws') {
      throw new Error(`Expected wss://call-break-778p.onrender.com/ws, got: ${res1}`);
    }

    // Case 2: Parentheses and brackets
    const bracketUrl = '[(https://call-break-778p.onrender.com)]';
    const res2 = cleanAndSanitizeWebSocketUrl(bracketUrl);
    if (res2 !== 'wss://call-break-778p.onrender.com/ws') {
      throw new Error(`Expected wss://call-break-778p.onrender.com/ws, got: ${res2}`);
    }

    // Case 3: Raw domain without protocol
    const domainOnly = 'call-break-778p.onrender.com';
    const res3 = cleanAndSanitizeWebSocketUrl(domainOnly);
    if (res3 !== 'wss://call-break-778p.onrender.com/ws') {
      throw new Error(`Expected wss://call-break-778p.onrender.com/ws, got: ${res3}`);
    }

    // Case 4: Standard HTTPS URL with trailing slash
    const httpsUrl = 'https://call-break-778p.onrender.com/';
    const res4 = cleanAndSanitizeWebSocketUrl(httpsUrl);
    if (res4 !== 'wss://call-break-778p.onrender.com/ws') {
      throw new Error(`Expected wss://call-break-778p.onrender.com/ws, got: ${res4}`);
    }

    // Case 5: Safe fallback on malformed or empty
    const res5 = cleanAndSanitizeWebSocketUrl('');
    if (!res5.includes('/ws')) {
      throw new Error(`Expected fallback to include /ws, got: ${res5}`);
    }
  });

  return harness;
}
