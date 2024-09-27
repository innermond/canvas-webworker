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
        b: data[startPixelIndex + 2]
    };

    if (colorDistance(startColor, newColorRgb) === 0) {
        self.postMessage(imageData); // No need to fill, return original data
        return;
    }

    const pixelStack = [{ x: startX, y: startY }];

    while (pixelStack.length > 0) {
        const { x, y } = pixelStack.pop();
        const pixelIndex = (y * width + x) * 4;
        const currentColor = {
            r: data[pixelIndex],
            g: data[pixelIndex + 1],
            b: data[pixelIndex + 2]
        };

        if (colorDistance(currentColor, startColor) <= tolerance) {
            data[pixelIndex] = newColorRgb.r;
            data[pixelIndex + 1] = newColorRgb.g;
            data[pixelIndex + 2] = newColorRgb.b;

            if (x > 0) pixelStack.push({ x: x - 1, y });
            if (x < width - 1) pixelStack.push({ x: x + 1, y });
            if (y > 0) pixelStack.push({ x, y: y - 1 });
            if (y < height - 1) pixelStack.push({ x, y: y + 1 });
        }
    }

    self.postMessage(imageData); // Return the modified image data
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
