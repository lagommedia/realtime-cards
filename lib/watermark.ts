/**
 * Composites a subtle text watermark onto an image for eBay upload.
 * Applied server-side (or client-side before upload) — never stored in the
 * collection; local photoDataUrl / photoBackDataUrl stay clean.
 */
export function applyWatermark(dataUrl: string, appName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }

      ctx.drawImage(img, 0, 0);

      const fontSize = Math.max(12, Math.round(img.height * 0.034));
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';

      const pad = Math.round(fontSize * 0.7);

      // Subtle drop shadow for legibility on any background
      ctx.shadowColor  = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur   = 5;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.fillText(appName, img.width - pad, img.height - pad);

      resolve(canvas.toDataURL('image/jpeg', 0.90));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
