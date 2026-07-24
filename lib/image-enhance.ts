/**
 * Canvas-based card photo enhancement: auto-levels, saturation boost, unsharp mask.
 * Applied client-side after crop; stored result replaces the raw crop.
 */
export function enhanceCardImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      // Pass 1 — color enhancement via CSS canvas filter
      const c1 = document.createElement('canvas');
      c1.width = w; c1.height = h;
      const ctx1 = c1.getContext('2d')!;
      ctx1.imageSmoothingEnabled = true;
      ctx1.imageSmoothingQuality = 'high';
      ctx1.filter = 'contrast(1.08) saturate(1.20) brightness(1.02)';
      ctx1.drawImage(img, 0, 0);
      ctx1.filter = 'none';

      // Pass 2 — unsharp mask (3×3 sharpen kernel): 0 -1 0 / -1 5 -1 / 0 -1 0
      const src = ctx1.getImageData(0, 0, w, h).data;
      const out = ctx1.createImageData(w, h);
      const d = out.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const center = src[i + c] * 5;
            const top    = y > 0   ? src[((y - 1) * w + x) * 4 + c] : src[i + c];
            const bot    = y < h-1 ? src[((y + 1) * w + x) * 4 + c] : src[i + c];
            const lft    = x > 0   ? src[(y * w + (x - 1)) * 4 + c] : src[i + c];
            const rgt    = x < w-1 ? src[(y * w + (x + 1)) * 4 + c] : src[i + c];
            d[i + c] = Math.min(255, Math.max(0, center - top - bot - lft - rgt));
          }
          d[i + 3] = src[i + 3];
        }
      }
      ctx1.putImageData(out, 0, 0);

      resolve(c1.toDataURL('image/jpeg', 0.90));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
