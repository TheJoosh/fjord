import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const cardsDir = path.resolve('public', 'Card Images');
const targetWidth = 600;
const targetHeight = 840;

const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeImage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const originalBuffer = await fs.promises.readFile(filePath);
  const beforeBytes = originalBuffer.length;

  let pipeline = sharp(originalBuffer, { failOn: 'none' }).rotate().resize({
    width: targetWidth,
    height: targetHeight,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (extension === '.png') {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 });
  } else if (extension === '.webp') {
    pipeline = pipeline.webp({ quality: 75, effort: 6 });
  } else {
    pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
  }

  const optimizedBuffer = await pipeline.toBuffer();

  if (optimizedBuffer.length >= beforeBytes) {
    return { beforeBytes, afterBytes: beforeBytes, skipped: true };
  }

  await fs.promises.writeFile(filePath, optimizedBuffer);
  return { beforeBytes, afterBytes: optimizedBuffer.length, skipped: false };
}

async function run() {
  if (!fs.existsSync(cardsDir)) {
    console.error(`Directory not found: ${cardsDir}`);
    process.exit(1);
  }

  const entries = await fs.promises.readdir(cardsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(cardsDir, entry.name))
    .filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()));

  if (!files.length) {
    console.log('No supported images found.');
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let optimizedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const { beforeBytes, afterBytes, skipped } = await optimizeImage(filePath);
    totalBefore += beforeBytes;
    totalAfter += afterBytes;
    if (skipped) {
      skippedCount += 1;
    } else {
      optimizedCount += 1;
    }
  }

  const savedBytes = totalBefore - totalAfter;
  const savedPct = totalBefore > 0 ? ((savedBytes / totalBefore) * 100).toFixed(2) : '0.00';

  console.log(`Images processed: ${files.length}`);
  console.log(`Optimized: ${optimizedCount}`);
  console.log(`Unchanged: ${skippedCount}`);
  console.log(`Before: ${formatMb(totalBefore)}`);
  console.log(`After: ${formatMb(totalAfter)}`);
  console.log(`Saved: ${formatMb(savedBytes)} (${savedPct}%)`);
}

run().catch((error) => {
  console.error('Image optimization failed:', error);
  process.exit(1);
});
