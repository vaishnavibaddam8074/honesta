
export async function convertToBlackAndWhite(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      const maxDim = 500; 
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      
      // Adjusted 'Slight Dark' Filter: Grayscale 100% + Brightness 45% + Contrast 115% + Subtle Blur
      // This protects text details (IDs, names) while keeping the item's silhouette recognizable.
      ctx.filter = 'grayscale(100%) brightness(45%) contrast(115%) blur(1px)';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Step 2: Final intensity cap to ensure high-glare areas don't leak information
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const avg = (r + g + b) / 3;
        
        // Prevent pure white areas from showing text by capping highlights
        if (avg > 180) {
          data[i] = 140;
          data[i+1] = 140;
          data[i+2] = 140;
        }
      }
      
      ctx.filter = 'none';
      ctx.putImageData(imageData, 0, 0);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = dataUrl;
  });
}

export async function compressOriginalImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      
      const maxDim = 600; 
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = dataUrl;
  });
}
