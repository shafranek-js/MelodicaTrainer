const DEFAULT_MIN_AUTO_FIT_ZOOM = 0.65;
const DEFAULT_AUTO_FIT_PADDING = 0.96;

export const isVisibleCanvasPixel = (data: Uint8ClampedArray, offset: number) => {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];

  return alpha > 12 && !(red > 245 && green > 245 && blue > 245);
};

export const getCanvasVisibleHeight = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width <= 0 || canvas.height <= 0) return null;

  try {
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = canvas.height - 1; y >= 0; y -= 1) {
      const rowOffset = y * canvas.width * 4;
      for (let x = 0; x < canvas.width; x += 1) {
        if (isVisibleCanvasPixel(data, rowOffset + x * 4)) {
          return y + 1;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const measureRenderedContentHeight = (scoreElement: HTMLDivElement) => {
  const scoreRect = scoreElement.getBoundingClientRect();
  let bottom = 0;

  scoreElement.querySelectorAll("canvas").forEach((canvas) => {
    const visibleHeight = getCanvasVisibleHeight(canvas);
    if (visibleHeight === null) return;

    const canvasRect = canvas.getBoundingClientRect();
    const scaleY = canvas.height > 0 ? canvasRect.height / canvas.height : 1;
    const canvasTop = canvasRect.top - scoreRect.top;
    bottom = Math.max(bottom, canvasTop + visibleHeight * scaleY);
  });

  return bottom > 0 ? bottom : scoreElement.scrollHeight;
};

export const getAutoFitZoom = (
  availableHeight: number,
  renderedHeight: number,
  minZoom = DEFAULT_MIN_AUTO_FIT_ZOOM,
  padding = DEFAULT_AUTO_FIT_PADDING
) => {
  const paddedAvailableHeight = availableHeight * padding;
  if (paddedAvailableHeight <= 0 || renderedHeight <= paddedAvailableHeight) {
    return null;
  }

  const nextZoom = Math.max(
    minZoom,
    Math.floor((paddedAvailableHeight / renderedHeight) * 100) / 100
  );

  return nextZoom < 0.99 ? nextZoom : null;
};
