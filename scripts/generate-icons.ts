import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  const iconSvgPath = path.join(publicDir, 'icon.svg');
  const maskSvgPath = path.join(publicDir, 'icon-maskable.svg');

  if (!fs.existsSync(iconSvgPath) || !fs.existsSync(maskSvgPath)) {
    throw new Error('Source SVGs not found in public directory.');
  }

  const iconSvg = fs.readFileSync(iconSvgPath);
  const maskSvg = fs.readFileSync(maskSvgPath);

  await sharp(iconSvg).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(iconSvg).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(maskSvg).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  await sharp(iconSvg).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(iconSvg).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(iconSvg).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'));

  console.log('PWA & Touch icons generated successfully.');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
