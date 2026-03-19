import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processIcons() {
  const sourceImage = path.resolve(process.argv[2]);
  if (!sourceImage || !fs.existsSync(sourceImage)) {
    console.error("Usage: node prep_icons.js <path_to_image>");
    process.exit(1);
  }

  const baseDir = __dirname;

  // 1. Create a 512x512 PNG
  const iconPng = path.join(baseDir, 'public', 'icon.png');
  await sharp(sourceImage)
    .resize(512, 512, { fit: 'contain', background: { r: 45, g: 55, b: 72, alpha: 1 } })
    .png()
    .toFile(iconPng);
  console.log("Created public/icon.png (512x512)");

  // Also create a 256x256 for ICO conversion
  const icon256 = path.join(baseDir, 'build', 'icon256.png');
  await sharp(sourceImage)
    .resize(256, 256, { fit: 'contain', background: { r: 45, g: 55, b: 72, alpha: 1 } })
    .png()
    .toFile(icon256);
  console.log("Created build/icon256.png");

  // 2. Create the ICO for Windows Electron build
  const iconIco = path.join(baseDir, 'build', 'icon.ico');
  const buf = await pngToIco(icon256);
  fs.writeFileSync(iconIco, buf);
  console.log("Created build/icon.ico");

  // 3. Create Capacitor Android Icons
  const androidSizes = {
    'mipmap-hdpi': 72,
    'mipmap-mdpi': 48,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  };

  const androidResDir = path.join(baseDir, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    for (const [folder, size] of Object.entries(androidSizes)) {
      const targetDir = path.join(androidResDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const bg = { r: 45, g: 55, b: 72, alpha: 1 };
      
      await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: bg })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));
        
      await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: bg })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));
        
      await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: bg })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
        
      console.log(`Created ${folder} icons (${size}x${size})`);
    }
    console.log("All Android icons created.");
  } else {
    console.log("Android res folder not found. Skipping Android icons. Will be generated during cap sync.");
  }

  console.log("\\nDone! All icons processed successfully.");
}

processIcons().catch(console.error);
