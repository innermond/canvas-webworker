// Set up the stage and layer
var stage = new Konva.Stage({
    container: 'container',
    width: 900,
    height: 400,
});

var layer = new Konva.Layer();
stage.add(layer);

// Variable to store the current path data
var pathData = '';
var currentPath; // Variable to hold the current path object
var currentImage; // Variable to hold the currently added image

// Create a temporary line for the preview (while moving the mouse)
var tempLine = new Konva.Line({
    points: [],
    stroke: 'green',
    strokeWidth: 2,
    lineCap: 'round',
    dash: [10, 5], // Dashed line to distinguish from the actual path
});
layer.add(tempLine);

// Variable to store the last clicked position
var lastPos = null;

// Variable to track if the path is closed
var isClosed = false;

// Variable to track if the path was already done
var isPrevious = false;

// Global variable to store the fill color with a default value
var fillColor = '#000000'; // Default fill color (black)

// Function to reset drawing state
function resetDrawingState() {
    if (currentPath) {
      currentPath.selected = false;
      if (isPrevious) {
        currentPath.strokeWidth(0);
      }
    }

    pathData = ''; 
    isClosed = false; 
    isPrevious = false;
    lastPos = null;
}

// Function to handle mouse click to add points to the path
function handleStageClick(e) {

  var pos = stage.getPointerPosition();
  // Store the current position as the last position
  lastPos = pos;

  if (isBucketMode) {
    if (didBucketPosition) {
      fillBucket();
    }
    didBucketPosition = true;
    return;
  }
  didBucketPosition = false;

    if (currentPath) {
      currentPath.selected = false;
      if (isPrevious) {
        currentPath.strokeWidth(0);
      }
    }
    if (isPrevious || isClosed || !currentPath) return; // Stop adding points if the path is closed or not defined

    if (pathData === '') {
        // If it's the first click, start the 'M'ove command
        pathData += `M${pos.x},${pos.y}`;
    } else {
        // Add line to ('L') for subsequent clicks
        pathData += ` L${pos.x},${pos.y}`;
    }

    // Update the path data
    currentPath.setAttr('data', pathData);
    layer.batchDraw();
}

// Function to handle mouse move to preview the next segment in real-time
function handleStageMouseMove(e) {
    if (isPrevious || isClosed || !lastPos) return; // Don't preview if path is closed or no previous point

    var pos = stage.getPointerPosition();

    // Update the tempLine to preview the line from the last position to the current mouse position
    tempLine.points([lastPos.x, lastPos.y, pos.x, pos.y]);
    layer.batchDraw();
}

// Function to handle double click to close the path
function handleStageDblClick() {
    if (isClosed || pathData === '') return; // Don't close if already closed or path is empty

    // Close the path by adding 'Z' to the SVG path data
    pathData += ' Z';

    // Update the path data and set the closed flag
    currentPath.setAttr('data', pathData);
    isClosed = true;  // Mark the path as closed
    isPrevious = false;

    // Fill the path with the current global fill color
    currentPath.fill(fillColor);

    // Set the stroke width to zero to make it invisible
    currentPath.strokeWidth(0); 

    // Enable dragging after closing the path
    currentPath.draggable(true);

    // Disable the temporary line
    tempLine.points([]);
    
    // Enable the "Fill Path" button and color picker after the path is closed
    document.getElementById('fillButton').disabled = false;
    document.getElementById('fillColorPicker').disabled = false;
    document.getElementById('deleteButton').disabled = false; // Enable delete button

    // Redraw the layer
    layer.batchDraw();
}

// Function to handle the "Fill Path" button click
function handleFillButtonClick() {
    if (!isClosed || !currentPath) return; // Only allow filling if the path is closed

    // Set the fill color for the closed path
    currentPath.fill(fillColor);

    // Set the stroke width to zero to make it invisible
    currentPath.strokeWidth(0); 

    // Redraw the layer to apply the fill
    layer.batchDraw();
}

// Create a new web worker
const floodFillWorker = new Worker('floodfillWorker.js');

// It control if flood filling is allowed
let isBucketMode = false;
// Position to start flood fill has been chosen
let didBucketPosition = false;

// Function to handle filling the image with the global color using Web Worker
function handleFillImageButtonClick() {
  isBucketMode = ! isBucketMode;
  // When filling mode begins it requires you 
  // to choose a starting color (by position) from image
  // exiting from bucket mode reset its state
  if (!isBucketMode) {
    didBucketPosition = false;
  }
}

function fillBucket() {
    if (!currentImage) return; // No image to fill
    if (!isBucketMode || !didBucketPosition) return;

    const imageElement = currentImage.image();
    const width = imageElement.width;
    const height = imageElement.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);

    const startPos = {
        x: Math.floor(lastClickPos.x),
        y: Math.floor(lastClickPos.y)
    };

    // Send image data and other details to the web worker
    floodFillWorker.postMessage({
        imageData,
        startPos,
        fillColor,
        tolerance: 25 // or any other tolerance value you want
    });

    // Handle the response from the web worker
    floodFillWorker.onmessage = function(e) {
            const stageWidth = stage.width();
            const stageHeight = stage.height();
            const imgWidth = width;
            const imgHeight = height;

            // Calculate aspect ratios
            const stageAspectRatio = stageWidth / stageHeight;
            const imgAspectRatio = imgWidth / imgHeight;

            // Determine how to scale the image to fit within the stage
            let newWidth, newHeight;
            if (imgAspectRatio > stageAspectRatio) {
                // Image is wider than the stage, scale by width
                newWidth = stageWidth;
                newHeight = (imgHeight * stageWidth) / imgWidth;
            } else {
                // Image is taller than the stage, scale by height
                newHeight = stageHeight;
                newWidth = (imgWidth * stageHeight) / imgHeight;
            }
            // Calculate the scaling factors
            imageScaleX = imgWidth / newWidth; // Scale factor for the width
            imageScaleY = imgHeight / newHeight; // Scale factor for the height

        const {modifiedImageData, x, y, w, h,} = e.data;
        // Create a new canvas to hold the modified image data
        const modifiedCanvas = document.createElement('canvas');
        modifiedCanvas.width = modifiedImageData.width;
        modifiedCanvas.height = modifiedImageData.height;

        const modifiedCtx = modifiedCanvas.getContext('2d');
        modifiedCtx.putImageData(modifiedImageData, 0, 0); // Apply the modified image data
        currentImage = new Konva.Image({
            x: currentImage.x(),
            y: currentImage.y(),
            image: modifiedCanvas,
            width: modifiedImageData.width/imageScaleX,
            height: modifiedImageData.height/imageScaleY,
            stroke: 'red',
            strokeWidth: 2,
            draggable: true // Make the image draggable
        });
        currentImage.crop({x, y, width: w, height: h});
        currentImage.width(w/imageScaleX)
        currentImage.height(h/imageScaleY)
        currentImage.x(currentImage.x() + x/imageScaleX)
        currentImage.y(currentImage.y() + y/imageScaleY)
        layer.add(currentImage);
        currentImage.on('click', function(evt) {
            const pos = stage.getPointerPosition();
            currentImage = this;
            lastClickPos = {
                x: (pos.x - currentImage.x()) * imageScaleX, // Adjust using the scale factor
                y: (pos.y - currentImage.y()) * imageScaleY  // Adjust using the scale factor
            };
            document.getElementById('deleteButton').disabled = false; // Enable delete button
            document.getElementById('fillImageButton').disabled = false; // Enable fill image button
        });
        layer.batchDraw(); // Redraw the layer to show the image
        document.getElementById('deleteButton').disabled = false; // Enable delete button after image is added
    };
}

// Function to get pixel color from the image at a given position
function getPixelColor(image, x, y) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3]
    };
}

// Function to convert hex color to RGB
function hexToRgb(hex) {
    var bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

// Helper function to convert RGB to hex
function rgbToHex(r, g, b) {
    return (r << 16) + (g << 8) + b; // Combine RGB into a single hex value
}

// Helper function to parse hex color
function parseColor(color) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { r, g, b };
}

// Function to handle the "Delete" button click
function handleDeleteButtonClick() {
    if (currentPath) {
        currentPath.destroy(); // Remove the current path
        currentPath = null; // Reset current path variable
        resetDrawingState(); // Reset drawing state
        
        // Disable buttons since there's no current path
        document.getElementById('fillButton').disabled = true;
        document.getElementById('fillColorPicker').disabled = true;
        document.getElementById('deleteButton').disabled = true;

        // Clear the temporary line
        tempLine.points([]);
        layer.batchDraw(); // Redraw the layer
    } else if (currentImage) {
        currentImage.destroy(); // Remove the current image
        currentImage = null; // Reset current image variable
        
        // Disable the delete button since there's no current image
        document.getElementById('deleteButton').disabled = true;
        layer.batchDraw(); // Redraw the layer
    }
}

// Function to handle the "Add New Path" button click
function handleNewPathButtonClick() {
    resetDrawingState(); // Reset the drawing state for a new path

    // Create a new Konva.Path object for the new path
    currentPath = new Konva.Path({
        data: '',
        stroke: 'green',
        strokeWidth: 3,
        fill: '' // Initially no fill
    });

    // Add the new path to the layer
    layer.add(currentPath);

    // Disable dragging until the path is closed
    currentPath.draggable(false);

    // Add click event listener to the new path to set it as current and restore drawing state
    currentPath.on('click', function (evt) {
        evt.cancelBubble = true; // Prevent the event from bubbling up

        if (currentPath) {
          currentPath.strokeWidth(0); // Reset previous path stroke
        }

        currentPath = this; // Set this path as the current path
        if (! currentPath?.selected) {
          currentPath.strokeWidth(2); // Reset previous path stroke
        }
        currentPath.selected = ! currentPath?.selected;
        isPrevious = true; // Mark currentPath as previous
        pathData = this.getAttr('data'); // Restore the path data
        lastPos = null; // Reset last position for drawing

        // Update button states
        document.getElementById('deleteButton').disabled = false; // Enable the delete button
        document.getElementById('fillButton').disabled = false; // Enable the fill button
        document.getElementById('fillColorPicker').disabled = false; // Enable the fill color picker
    });

    // Disable the fill button, color picker, and delete button since we are starting a new path
    document.getElementById('fillButton').disabled = true;
    document.getElementById('fillColorPicker').disabled = true;
    document.getElementById('deleteButton').disabled = true;

    // Clear the temporary line
    tempLine.points([]);
    
    // Redraw the layer
    layer.batchDraw();
}

var lastClickPos = null; // Global variable to store the last clicked position on the image
var imageScaleX, imageScaleY; // Variables to store the scaling factors

// Function to handle image upload
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        return; // Exit if no file is selected
    }
    
    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const stageWidth = stage.width();
            const stageHeight = stage.height();
            const imgWidth = img.width;
            const imgHeight = img.height;

            // Calculate aspect ratios
            const stageAspectRatio = stageWidth / stageHeight;
            const imgAspectRatio = imgWidth / imgHeight;

            // Determine how to scale the image to fit within the stage
            let newWidth, newHeight;
            if (imgAspectRatio > stageAspectRatio) {
                // Image is wider than the stage, scale by width
                newWidth = stageWidth;
                newHeight = (imgHeight * stageWidth) / imgWidth;
            } else {
                // Image is taller than the stage, scale by height
                newHeight = stageHeight;
                newWidth = (imgWidth * stageHeight) / imgHeight;
            }
            // Calculate the scaling factors
            imageScaleX = imgWidth / newWidth; // Scale factor for the width
            imageScaleY = imgHeight / newHeight; // Scale factor for the height

            currentImage = new Konva.Image({
                x: (stageWidth - newWidth) / 2, // Center horizontally
                y: (stageHeight - newHeight) / 2, // Center vertically
                image: img,
                width: newWidth,
                height: newHeight,
                draggable: true // Make the image draggable
            });
            layer.add(currentImage);
            currentImage.on('click', function(evt) {
                const pos = stage.getPointerPosition();
                currentImage = this;
                lastClickPos = {
                    x: (pos.x - currentImage.x()) * imageScaleX, // Adjust using the scale factor
                    y: (pos.y - currentImage.y()) * imageScaleY  // Adjust using the scale factor
                };
                document.getElementById('deleteButton').disabled = false; // Enable delete button
                document.getElementById('fillImageButton').disabled = false; // Enable fill image button
            });
            layer.batchDraw(); // Redraw the layer to show the image
            document.getElementById('deleteButton').disabled = false; // Enable delete button after image is added
        };
        img.src = event.target.result; // Set image source to the file's data URL
    };
    
    reader.readAsDataURL(file); // Read the file as a data URL
}

// Function to handle color picker change
function handleColorPickerChange() {
    fillColor = document.getElementById('fillColorPicker').value; // Update global fillColor
}

// Attach event listeners
stage.on('click', handleStageClick);
stage.on('mousemove', handleStageMouseMove);
stage.on('dblclick', handleStageDblClick);
document.getElementById('fillButton').addEventListener('click', handleFillButtonClick);
document.getElementById('fillImageButton').addEventListener('click', handleFillImageButtonClick);
document.getElementById('deleteButton').addEventListener('click', handleDeleteButtonClick);
document.getElementById('newPathButton').addEventListener('click', handleNewPathButtonClick);
document.getElementById('uploadImageButton').addEventListener('change', handleImageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update fillColor on change
