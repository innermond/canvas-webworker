self.onmessage = function(e) {
    const { imageData, startPos, fillColor, tolerance, justContour } = e.data;
    const { data, width, height } = imageData;
    // TODO handle fillColor with alpha 
    const newColorRgb = hexToRgb(fillColor);
    const startX = startPos.x;
    const startY = startPos.y;

    const startPixelIndex = (startY * width + startX) * 4;
    const startColor = {
        r: data[startPixelIndex],
        g: data[startPixelIndex + 1],
        b: data[startPixelIndex + 2],
        a: data[startPixelIndex + 3] ?? 255,
    };

    const pixelStack = [{ x: startX, y: startY }];
    const modifiedPixels = []; // Array to keep track of modified pixel data
    const visited = new Set(); // Set to track visited pixel
    const borderPixels = []; // Array to store border pixels

    // Initialize bounding box variables
    let minX = startX, minY = startY, maxX = startX, maxY = startY;

    while (pixelStack.length > 0) {
      const { x, y } = pixelStack.pop();

      // Boundary check
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pixelIndex = (y * width + x) * 4;

      // Check if this pixel has already been processed
      const pixelKey = `${x},${y}`;
      if (visited.has(pixelKey)) continue;
      visited.add(pixelKey); // Mark the pixel as visited

      const currentColor = {
        r: data[pixelIndex],
        g: data[pixelIndex + 1],
        b: data[pixelIndex + 2],
        a: data[pixelIndex + 3] ?? 255,
      };

      // Check if the current pixel matches the start color within tolerance
      const distance = colorDistance(currentColor, startColor);
      if (distance <= tolerance) {
        if (justContour) {
          const isBorderPixel = checkIsBorder(x, y, width, height, data, startColor, tolerance);
          if (isBorderPixel) {
            borderPixels.push({ x, y });
            // Update bounding box
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          } 
        } else {
          modifiedPixels.push({x, y});
          // Update bounding box
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        // Large image may overflow JS array limit - unsigned 4-bytes integer
        if (pixelStack.length >= 2**32 - 5) {
          throw new Error('stack overflow')
        }

        // Push neighboring pixels onto the stack
        if (x > 0) {
          pixelStack.push({ x: x - 1, y }); // Left
        }
        if (x < width - 1) {
          pixelStack.push({ x: x + 1, y }); // Right
        }
        if (y > 0) {
          pixelStack.push({ x, y: y - 1 }); // Up
        }
        if (y < height - 1) {
          pixelStack.push({ x, y: y + 1 }); // Down
        }
      }
    }

    const newWidth = maxX - minX + 1;
    const newHeight = maxY - minY + 1;

    // Create a new ImageData object with all pixels initially transparent
    // It will contains somewhere modified pixels, the others being transparent
    // It has same width & height as source image - is a transparent layer painted with only modified pixels 
    const floodImageData = new ImageData(width, height);

    // Set only modified pixels in the new ImageData
    let index = 0;
    if ( ! justContour) {
      modifiedPixels.forEach(pixel => {
        index = (pixel.y * width + pixel.x) * 4;
        floodImageData.data[index] = newColorRgb.r;     // Red
        floodImageData.data[index + 1] = newColorRgb.g; // Green
        floodImageData.data[index + 2] = newColorRgb.b; // Blue
        floodImageData.data[index + 3] = newColorRgb.a; // Alpha
      });
    } else {
      const black = {r: 0, g: 0, b: 0};
      const white = {r: 255, g: 255, b: 255};
      let antColor = black;
      let swapAntColor = false;
      borderPixels.forEach((pixel, inx) => {
        inx++;
        if (inx%3 === 0) {
          swapAntColor = ! swapAntColor;
        }
        antColor = swapAntColor ? white : black;
        index = (pixel.y * width + pixel.x) * 4;
        floodImageData.data[index] = antColor.r;     // Red
        floodImageData.data[index + 1] = antColor.g; // Green
        floodImageData.data[index + 2] = antColor.b; // Blue
        floodImageData.data[index + 3] = 255; // Alpha
      });

    }

    const msg = { floodImageData, x: minX, y: minY, w: newWidth, h: newHeight,};
    if (justContour) {
      msg.justContour = true;
    }
    self.postMessage(msg);
};

// Utility functions

// Function to check if a pixel is a border pixel
function checkIsBorder(x, y, width, height, data, startColor, tolerance) {
  const neighbors = [
    { x: x - 1, y }, // Left
    { x: x - 1, y: y - 1 }, // Up Left
    { x: x + 1, y: y - 1 }, // Up Right
    { x: x + 1, y }, // Right
    { x: x - 1, Y: y + 1 }, // Down Left
    { x: x + 1, Y: y + 1 }, // Down Right
    { x, y: y - 1 }, // Up
    { x, y: y + 1 }  // Down
  ];

  for (const neighbor of neighbors) {
    if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
      const neighborIndex = (neighbor.y * width + neighbor.x) * 4;
      const neighborColor = {
        r: data[neighborIndex + 0],
        g: data[neighborIndex + 1],
        b: data[neighborIndex + 2],
        a: data[neighborIndex + 3] ?? 255,
      };
      const distance = colorDistance(neighborColor, startColor);
      if (distance > tolerance) {
        // The neighbor is outside the region, so this pixel is on the border
        return true;
      }
    }
  }

  // If all neighbors are within tolerance, this pixel is not a border pixel
  return false;
}

function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2) +
    Math.pow(c1.a - c2.a, 2)
  );
}

function hexToRgb(hex) {
  var bigint = parseInt(hex.slice(1), 16);

  // Extract RGB components
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  // Check if there's an alpha channel
  const alpha = hex.length === 9 ? ((bigint >> 24) & 255) : 255; // Default alpha = 1

  return { r, g, b, a: alpha };
}
