self.onmessage = function(e) {
  const {canvas, img, x, y, w, h, tolerance, startX, startY, newColorRgb} = e.data; 
  const {width, height} = canvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, x, y, w, h);

  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  // Use a stack for flood fill
  const pixelStack = [];

  // Get the target pixel's color at start position
  const startPixelIndex = (startY * width + startX) * 4;
  const startColor = {
      r: data[startPixelIndex],
      g: data[startPixelIndex + 1],
      b: data[startPixelIndex + 2]
  };

  // Check if the target color and new color are the same (if yes, do nothing)
  if (colorDistance(startColor, newColorRgb) === 0) {
      return; // No need to fill
  }

  // Push the starting pixel into the stack
  pixelStack.push({ x: startX, y: startY });

  // Flood fill algorithm using a stack
  while (pixelStack.length > 0) {
      const { x, y } = pixelStack.pop();
      const pixelIndex = (y * width + x) * 4;

      // Get the current pixel color
      const currentColor = {
          r: data[pixelIndex],
          g: data[pixelIndex + 1],
          b: data[pixelIndex + 2]
      };

      // Check if the pixel color is within the tolerance
      if (colorDistance(currentColor, startColor) <= tolerance) {
          // Fill the pixel with the new color
          data[pixelIndex] = newColorRgb.r;     // R
          data[pixelIndex + 1] = newColorRgb.g; // G
          data[pixelIndex + 2] = newColorRgb.b; // B

          // Add neighboring pixels to the stack
          if (x > 0) pixelStack.push({ x: x - 1, y }); // Left pixel
          if (x < width - 1) pixelStack.push({ x: x + 1, y }); // Right pixel
          if (y > 0) pixelStack.push({ x, y: y - 1 }); // Top pixel
          if (y < height - 1) pixelStack.push({ x, y: y + 1 }); // Bottom pixel
      }
  }

    canvas[
    canvas.convertToBlob
      ? 'convertToBlob' // specs
      : 'toBlob'        // current Firefox
   ]()
    .then(blob => {
      const dataURL = new FileReaderSync().readAsDataURL(blob);
      self.postMessage({dataURL});
    });
};

// Function to calculate the color distance (Euclidean distance)
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}
