/**
 * Prepares a photo for the fan wall in the browser: turned the right way up, at most 1600 pixels on
 * the long side, re-encoded as JPEG. Re-encoding drops the file's metadata, including the GPS
 * position phones store (the server strips any that is left as well).
 */
export async function preparePhoto(file: File, maxSide = 1600): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('Choose a photo (JPEG or PNG)');
  if (file.size > 25 * 1024 * 1024) throw new Error('That photo is too large');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    throw new Error('This browser cannot open that photo. Try a JPEG or PNG.');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  if (Math.min(width, height) < 200) throw new Error('The photo is too small (at least 200 pixels a side)');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the photo');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  for (const quality of [0.85, 0.75, 0.6]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length * 0.75 < 2.8 * 1024 * 1024) return { dataUrl, width, height };
  }
  throw new Error('The photo is too large even after resizing');
}
