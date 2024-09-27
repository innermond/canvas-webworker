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
        a: data[startPixelIndex + 3],
    };

    // Early exit if the fill color is the same as the start color
    if (colorDistance(startColor, newColorRgb) === 0) {
        self.postMessage(null); // No modification needed, return null
        return;
    }

    const pixelStack = [{ x: startX, y: startY }];
    const modifiedPixels = []; // Array to keep track of modified pixel data

    // Initialize bounding box variables
    let minX = startX, minY = startY, maxX = startX, maxY = startY;

    while (pixelStack.length > 0) {
        const { x, y } = pixelStack.pop();

        // Boundary check
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const pixelIndex = (y * width + x) * 4;
        const currentColor = {
            r: data[pixelIndex],
            g: data[pixelIndex + 1],
            b: data[pixelIndex + 2],
            a: data[pixelIndex + 3],
        };

        // Check if the current pixel matches the start color within tolerance
        if (colorDistance(currentColor, startColor) <= tolerance) {
            // Fill the pixel with the new color
            data[pixelIndex] = newColorRgb.r;        // Red
            data[pixelIndex + 1] = newColorRgb.g;    // Green
            data[pixelIndex + 2] = newColorRgb.b;    // Blue

            modifiedPixels.push({ x, y});

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

    // Calculate the width and height of the new ImageData based on the bounding box
    const newWidth = maxX - minX + 1;
    const newHeight = maxY - minY + 1;

    // Create a new ImageData object for the enclosing area
    const enclosingImageData = new ImageData(newWidth, newHeight);

    // Fill the new ImageData with the modified pixels
    modifiedPixels.forEach(pixel => {
        const newPixelIndex = ((pixel.y - minY) * newWidth + (pixel.x - minX)) * 4;
        enclosingImageData.data[newPixelIndex] = newColorRgb.r;     // Red
        enclosingImageData.data[newPixelIndex + 1] = newColorRgb.g; // Green
        enclosingImageData.data[newPixelIndex + 2] = newColorRgb.b; // Blue
        enclosingImageData.data[newPixelIndex + 3] = 255;//newColorRgb.a; // Alpha
    });


  console.log(newWidth * newHeight * 4, enclosingImageData.data.length)

    // Post the smaller ImageData back to the main thread
    self.postMessage({
        modifiedImageData: enclosingImageData,
        x: minX,
        y: minY,
        w: newWidth,
        h: newHeight,
    });
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
