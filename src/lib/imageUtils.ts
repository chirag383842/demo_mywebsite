/**
 * Client-side high-quality image compressor and optimizer.
 * Scales down large camera photos to a max dimension (default 800px)
 * and outputs an optimized WebP or JPEG DataURL (~40-80KB).
 */
export async function optimizeImageForProduct(
  file: File,
  maxDim = 800,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Empty file content'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp.startsWith('data:image/webp')) {
            resolve(webp);
            return;
          }
        } catch {
          /* browser might not support webp export */
        }

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes gallery media files.
 * Images are compressed to max 1280px WebP/JPEG (~60-90KB) for instantaneous multi-device sync.
 * Non-image media (video/audio) are read as standard DataURLs.
 */
export async function optimizeGalleryMedia(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    try {
      return await optimizeImageForProduct(file, 1280, 0.82);
    } catch {
      // Fallback to raw data url if canvas processing encounters an issue
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.readAsDataURL(file);
  });
}
