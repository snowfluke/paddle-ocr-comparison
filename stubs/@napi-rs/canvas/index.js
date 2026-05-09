const NativeCanvas = typeof HTMLCanvasElement !== "undefined" ? HTMLCanvasElement : class {};

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }
  throw new Error("No canvas implementation available");
}

function createImageData(width, height) {
  if (typeof ImageData !== "undefined") return new ImageData(width, height);
  throw new Error("ImageData not available");
}

async function loadImage(source) {
  if (typeof Image !== "undefined" && typeof document !== "undefined") {
    const img = new Image();
    if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
      const blob = new Blob([source]);
      img.src = URL.createObjectURL(blob);
    } else if (typeof source === "string") {
      img.src = source;
    }
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const canvas = createCanvas(img.width || img.naturalWidth, img.height || img.naturalHeight);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return canvas;
  }
  throw new Error("loadImage not available");
}

export { NativeCanvas as Canvas, createCanvas, createImageData as ImageData, loadImage };