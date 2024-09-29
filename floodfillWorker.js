self.onmessage = function(e) {
    const { imageData, startPos, fillColor, tolerance } = e.data;
    const { data, width, height } = imageData;

    const newColorRgb = hexToRgb(fillColor);
    const startX = startPos.x;
    const startY = startPos.y;

    const startPixelIndex = (startY * width + startX) * 4;
    const startColor = {
        r: data[startPixelIndex],
        g: data[startPixelIndex + 1],
        b: data[startPixelIndex + 2],
    };

    const pixelStack = [{ x: startX, y: startY }];
    const modifiedPixels = []; // Array to keep track of modified pixel data
    // Initialize bounding box variables
    let minX = startX, minY = startY, maxX = startX, maxY = startY;

    while (pixelStack.length > 0) {
        const { x, y } = pixelStack.pop();

        // Boundary check
        if (x < 1 || x > width-1 || y < 1 || y > height-1) continue;

        const pixelIndex = (y * width + x) * 4;
        const currentColor = {
            r: data[pixelIndex],
            g: data[pixelIndex + 1],
            b: data[pixelIndex + 2],
        };

        if (colorDistance(startColor, newColorRgb) === 0) {
          continue;
        }

        // Check if the current pixel matches the start color within tolerance
        const distance = colorDistance(currentColor, startColor);
        if (distance <= tolerance) {
            // Fill the pixel with the new color
            data[pixelIndex] = newColorRgb.r;        // Red
            data[pixelIndex + 1] = newColorRgb.g;    // Green
            data[pixelIndex + 2] = newColorRgb.b;    // Blue
            data[pixelIndex + 3] = 255;               // Set alpha to fully opaque

            modifiedPixels.push({x, y});

            // Update bounding box
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            // Push neighboring pixels onto the stack
            pixelStack.push({ x: x - 1, y }); // Left
            pixelStack.push({ x: x + 1, y }); // Right
            pixelStack.push({ x, y: y - 1 }); // Up
            pixelStack.push({ x, y: y + 1 }); // Down
        }
    }

    const newWidth = maxX - minX + 1;
    const newHeight = maxY - minY + 1;

    // Create a new ImageData object with all pixels initially transparent
    const floodImageData = new ImageData(width, height);

    // Set only modified pixels in the new ImageData
    let index = 0;
    modifiedPixels.forEach(pixel => {
        index = (pixel.y * width + pixel.x) * 4;
        floodImageData.data[index] = newColorRgb.r;     // Red
        floodImageData.data[index + 1] = newColorRgb.g; // Green
        floodImageData.data[index + 2] = newColorRgb.b; // Blue
        floodImageData.data[index + 3] = 255; // Alpha
    });
    self.postMessage({ floodImageData, x: minX, y: minY, w: newWidth, h: newHeight,});
};

// Utility functions
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}
