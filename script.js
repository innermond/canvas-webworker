// Set up the stage and imageLayer
var stage = new Konva.Stage({
    container: 'container',
    width: 800,
    height: 400,
});

// Order of layers is important
var imageLayer = new Konva.Layer();
stage.add(imageLayer);
var bucketLayer = new Konva.Layer();
stage.add(bucketLayer);
var pathLayer = new Konva.Layer();
stage.add(pathLayer);

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
pathLayer.add(tempLine);

// Variable to store the last clicked position
var lastPos = null;

// Variable to track if the path is closed
var isClosed = false;

// Variable to track if the path was already done
var isPrevious = false;

// Global variable to store the fill color with a default value
var fillColor = '#000000'; // Default fill color (black)

// It controlls sensitivity for flooding image areas with fillColor
var fillColorSensitivity = 25;

// Size of pencil
var pencilScale = 30;

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
    if (e.target === stage) return;
    // Event is triggered clicking on a transparent pixel of a flood image
    // Find coresponding image from imageLayer
    if (e.target?.parent === bucketLayer) {
      // Check images on imageLayer - beneath bucketLayer
      imageLayer.children.reverse().forEach(img => {
        const {x, y} = img.getRelativePointerPosition();
        const w = img.width();
        const h = img.height();
        const isInside = (0 < x && x < w && 0 < y && y < h);
        if (isInside) {
          fillBucket(img);
        }
      })
      return;
    }

    fillBucket(e.target);
    return;
  }
  // FIXME 
return
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
    pathLayer.batchDraw();
}


// Function to handle mouse move to preview the next segment in real-time
function handleStageMouseMove(e) {
  return
    if (isPrevious || isClosed || !lastPos) return; // Don't preview if path is closed or no previous point
    if (isBucketMode) return;

    var pos = stage.getPointerPosition();

    // Update the tempLine to preview the line from the last position to the current mouse position
    tempLine.points([lastPos.x, lastPos.y, pos.x, pos.y]);
    pathLayer.batchDraw();
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

    // Redraw the imageLayer
    pathLayer.batchDraw();
}

// Function to handle the "Fill Path" button click
function handleFillClick() {
    if (!isClosed || !currentPath) return; // Only allow filling if the path is closed

    // Set the fill color for the closed path
    currentPath.fill(fillColor);

    // Set the stroke width to zero to make it invisible
    currentPath.strokeWidth(0); 

    // Redraw the imageLayer to apply the fill
    imageLayer.batchDraw();
}

// Create a new web worker
const floodFillWorker = new Worker('floodfillWorker.js');

// It control if flood filling is allowed
let isBucketMode = false;

// Function to handle filling the image with the global color using Web Worker
function handleFillImageClick() {
  isBucketMode = ! isBucketMode;
  // When filling mode begins it requires you 
  // to choose a starting color (by position) from image
  // exiting from bucket mode reset its state
  document.getElementById('fillImageButton').classList.toggle('inactive'); // Enable fill image button
  if (isBucketMode) {
    lastPos = stage.getPointerPosition();
    isDrawPencil = false;
    document.getElementById('drawPencil').classList.add('inactive');
  }

}

function fillBucket(currentImage) {
    if (!isBucketMode || !currentImage) return;

    const scaled = () => {
        const scaledX = currentImage.width() / currentImage.image().width;
        const scaledY = currentImage.height() / currentImage.image().height;
        return [scaledX, scaledY];
    };

    const [scaledX, scaledY] = scaled();
    
    const imageElement = currentImage.image();
    lastClickPos = currentImage.getRelativePointerPosition();
    // Native (unscaled) dimensions of image
    const width = imageElement.width;
    const height = imageElement.height;

    // Get native image data to be sent outside to the worker
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = width;
    imageCanvas.height = height;
    const imageCtx = imageCanvas.getContext('2d');

    // Merge all images on bucket layer = collapse them
    let bucketCanvas = bucketLayer.toCanvas();
    bucketLayer.removeChildren();
    const bucketImage = new Konva.Image({
      image: bucketCanvas,
    })
    bucketLayer.add(bucketImage);

    imageCtx.drawImage(imageElement, 0, 0);
    // TODO why use scaledX/Y here? Why?
    imageCtx.drawImage(bucketCanvas, currentImage.x(), currentImage.y(), width, height, 0, 0, width/scaledX, height/scaledY);

// FIXME
const imageDbg = document.querySelector('#image > canvas')
imageDbg.parentNode.replaceChild(imageCanvas, imageDbg)

    const imageData = imageCtx.getImageData(0, 0, width, height);

    const localPos = currentImage.getRelativePointerPosition();
    const startPos = {
        x: Math.floor(localPos.x/scaledX),
        y: Math.floor(localPos.y/scaledY)
    };
  

    // Send image data and other details to the web worker
    floodFillWorker.postMessage({
        imageData,
        startPos,
        fillColor,
        tolerance: fillColorSensitivity // or any other tolerance value you want
    });

    // Handle the response from the web worker
    floodFillWorker.onmessage = async function(e) {
        const [scaledX, scaledY] = scaled();

        // Native pixels
        const {floodImageData, x, y, w, h,} = e.data;
        // Create a new canvas to hold the modified image data
        const floodCanvas = document.createElement('canvas');
        floodCanvas.width = w;
        floodCanvas.height = h;

        const floodCtx = floodCanvas.getContext('2d');
      // Polite mode: take into account already draw pixels
        const floodBmp = await createImageBitmap(floodImageData)
        floodCtx.drawImage(floodBmp, x, y, w, h, 0, 0, w, h); // Apply the modified image data
        // !! Pay attention to -x, -y
        //floodCtx.putImageData(floodImageData, -x, -y, x, y, w, h); // Apply the modified image data
        const floodImage = new Konva.Image({
            x: lastClickPos.x,
            y: lastClickPos.y,
            image: floodCanvas,
            globalCompositeOperation: gco(),
        });
        // Scale native dimensions to be in sync with scaled image
        floodImage.width(w*scaledX)
        floodImage.height(h*scaledY)
        // position using scaled x, y
        floodImage.x(currentImage.x() + x*scaledX)
        floodImage.y(currentImage.y() + y*scaledY)
      
        bucketLayer.add(floodImage);
        
        // Collapse images from bucket layer into single one
        bucketCanvas = bucketLayer.toCanvas();
        bucketLayer.removeChildren();
        const bucketImage = new Konva.Image({
          image: bucketCanvas,
        });
      
      // FIXME
      const floodDbg = document.querySelector('#flood > canvas')
      floodDbg.parentNode.replaceChild(floodCanvas, floodDbg)
      const bucketDbg = document.querySelector('#bucket > canvas')
      bucketDbg.parentNode.replaceChild(bucketCanvas, bucketDbg)

        bucketImage.on('click', function(e) {
          let a = 0; // Assume transparency, so the event will bubble to trigger the flood 
          const pos = this.getRelativePointerPosition();
          // img is unscaled native image
          const img = this.image();
          // getImageData is raw data, not scaled but pos.x, pos.y are scaled so must be unscaled
          a = img.getContext('2d').getImageData(pos.x, pos.y, 1, 1).data[3];
          // Cancel bubbling when a non-transparency pixel was found
          // and painted aria protection is off
          let isBubbling = a === 0; // bubble up when transparent
          if (!isBubbling && !isDrawProtect) isBubbling = true; 
          if (isFillClean) isBubbling = true;
          e.cancelBubble = !isBubbling;
        });

        bucketLayer.add(bucketImage);

        bucketLayer.batchDraw(); // Redraw the imageLayer to show the image

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
function handleDeleteClick() {
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
        imageLayer.batchDraw(); // Redraw the imageLayer
    } else if (currentImage) {
        currentImage.destroy(); // Remove the current image
        currentImage = null; // Reset current image variable
        
        // Disable the delete button since there's no current image
        document.getElementById('deleteButton').disabled = true;
        imageLayer.batchDraw(); // Redraw the imageLayer
    }
}

// Function to handle the "Add New Path" button click
function handleNewPathClick() {
    resetDrawingState(); // Reset the drawing state for a new path

    // Create a new Konva.Path object for the new path
    currentPath = new Konva.Path({
        data: '',
        stroke: 'green',
        strokeWidth: 3,
        fill: '' // Initially no fill
    });

    // Add the new path to the imageLayer
    pathLayer.add(currentPath);

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
    
    // Redraw the imageLayer
    pathLayer.batchDraw();
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

            const newImage = new Konva.Image({
                x: (stageWidth - newWidth) / 2, // Center horizontally
                y: (stageHeight - newHeight) / 2, // Center vertically
                image: img,
                width: newWidth,
                height: newHeight,
                stroke: 'magenta',
                strokeWidht: 2,
                //draggable: true // Make the image draggable
            });
            imageLayer.add(newImage);
          
            newImage.on('click', function(evt) {
                const pos = stage.getPointerPosition();
                lastClickPos = {
                    x: (pos.x - this.x()) * imageScaleX, // Adjust using the scale factor
                    y: (pos.y - this.y()) * imageScaleY  // Adjust using the scale factor
                };
                document.getElementById('deleteButton').disabled = false; // Enable delete button
            });

            //const pos = stage.getPointerPosition();
            //lastClickPos = {
            //    x: (pos.x - newImage.x()) * imageScaleX, // Adjust using the scale factor
            //    y: (pos.y - newImage.y()) * imageScaleY  // Adjust using the scale factor
            //};

            imageLayer.batchDraw(); // Redraw the imageLayer to show the image
            
            document.getElementById('deleteButton').disabled = false; // Enable delete button after image is added
        };
        img.src = event.target.result; // Set image source to the file's data URL
    };
    
    reader.readAsDataURL(file); // Read the file as a data URL
}

// Function to handle color picker change
function handleColorPickerChange() {
    fillColor = document.getElementById('fillColorPicker').value; // Update global fillColor
  if (pencil) {
    pencil.fill(fillColor);
  }
}

function handleFillImageSensitivityClick() {
    fillColorSensitivity = document.getElementById('fillImageSensitivityButton').value; // Update global fillColor
    document.getElementById('fillImageSensitivityLabel').textContent = fillColorSensitivity; // Update global fillColorSensitivity
}


function handleScalePencil() {
    pencilScale = document.getElementById('scalePencilButton').value;
    if (pencil) {
      pencil.setAttrs({width: pencilScale, height: pencilScale});
    }
    document.getElementById('scalePencilLabel').textContent = pencilScale;
}

let pencil;
let isDrawPencil = false;
let mousemove = false;

var drawLayer = new Konva.Layer();
stage.add(drawLayer);

function gco() {
  const v = isFillClean ? 'destination-out' : (isDrawProtect ? 'destination-over' : 'source-over');
  return v;
}
// Mousedown event starts drawing a new shape
stage.on('mousedown', (evt) => {
  // Must be first
  const pos = stage.getPointerPosition();
  lastPos = pos;

  if (!isDrawPencil) return;

  evt.cancelBubble = true;
  mousemove = true;

  if (pencil) return;

  // Create Pencil
  pencil = new Konva.Rect({
    x: pos.x,
    y: pos.y,
    offsetX: pencilScale*0.5,
    offsetY: pencilScale*0.5,
    width: pencilScale,
    height: pencilScale,
    fill: fillColor,
  });
  drawLayer.add(pencil);
  drawLayer.batchDraw();
});

const collapseDraw = (reinit) => (evt) => {
  if (!isDrawPencil) return;
  if (!pencil) return;

  evt.cancelBubble = true;

  if (reinit) {
    mousemove = false;
    pencilPrevPos = null;
  } else {
    pencilPrevPos = null;
  }

  // Collapse drawLayer
  const drawCanvas = drawLayer.toCanvas();
  drawLayer.removeChildren();
  drawLayer.batchDraw();

  // Transfer image
  const drawImage = new Konva.Image({
    image: drawCanvas,
    globalCompositeOperation: gco(),
  });
  bucketLayer.add(drawImage);

  let bucketCanvas = bucketLayer.toCanvas();
  bucketLayer.removeChildren();
  const bucketImage = new Konva.Image({
    image: bucketCanvas,
  });


  bucketLayer.add(bucketImage);

  bucketLayer.batchDraw();
};

const collapseDrawReinitNo = collapseDraw(false);
const collapseDrawReinitYes = collapseDraw(true);
// Mouseup event finalizes the shape
document.addEventListener('mouseup', collapseDrawReinitYes);
stage.on('mouseup', collapseDrawReinitYes);
stage.on('mouseleave', collapseDrawReinitNo);

let pencilPrevPos = null;
// Mousemove event is cloning
stage.on('mousemove', (evt) => {
  if (!isDrawPencil) return;
  if (!mousemove) return;
  if (!pencil) return;

  evt.cancelBubble = true;


  // Get the current mouse position
  let pos = stage.getPointerPosition();

  if (pencilPrevPos) {
    // Calculate the total distance between the two points
    const distanceX = pos.x - pencilPrevPos.x;
    const distanceY = pos.y - pencilPrevPos.y;
    let numRectangles = 0;
    if (distanceX === 0 && distanceY === 0) {
     // Nothing 
    } else if (distanceX === 0) {
      numRectangles = Math.ceil(Math.abs(distanceY/pencilScale));
    } else if (distanceY === 0) {
      numRectangles = Math.ceil(Math.max(Math.abs(distanceX/pencilScale)));
    } else {
      numRectangles = Math.ceil(Math.max(Math.abs(distanceX/pencilScale), Math.abs(distanceY/pencilScale)));
    }

    if (numRectangles > 1) {
      const k = 4*(numRectangles - 1);
      // Calculate the step for each rectangle along the line
      const stepX = distanceX / k;
      const stepY = distanceY / k;
      // Place rectangles at evenly spaced positions
      for (let i = 0; i < k; i++) {
        const x = pencilPrevPos.x + i * stepX;
        const y = pencilPrevPos.y + i * stepY;

        if (isFillClean && pencil) {
          pencil.fill('#FFFFFF');
        }
        const cloned = pencil.clone({
          x, y,
        });
        drawLayer.add(cloned);
        pos = {x, y};
      }
    }
  }
  
  if (isFillClean && pencil) {
    pencil.fill('#FFFFFF');
  }
  const cloned = pencil.clone({
    x: pos.x,
    y: pos.y,
  });
  drawLayer.add(cloned);

  pencilPrevPos = pos;
  drawLayer.batchDraw();
});

let isDrawProtect = false;

function handleDrawProtect() {
  isDrawProtect = !isDrawProtect;
  document.getElementById('drawProtectCheckbox').checked = isDrawProtect;
  document.getElementById('drawProtectLabel').textContent = isDrawProtect ? 'active' : 'inactive';
}

let isFillClean = false;

function handleFillClean() {
  isFillClean = !isFillClean;
  if (!isFillClean && pencil) {
    pencil.fill(fillColor);
  }
  document.getElementById('fillCleanCheckbox').checked = isFillClean;
  document.getElementById('fillCleanCheckboxLabel').textContent = isFillClean ? 'active' : 'inactive';
}

let pencilShape = 'rectangle';

function handlePencilShape(evt) {
  pencilShape = evt.target.value;
  if (! pencil) return;

  switch (pencilShape) {
    case 'circle':
      pencil = new Konva.Circle({
        x: lastPos.x,
        y: lastPos.y,
        width: pencilScale,
        height: pencilScale,
        fill: fillColor,
      });
    break;
    case 'rhomb':
      pencil = new Konva.Rect({
        x: lastPos.x,
        y: lastPos.y,
        offsetX: pencilScale*0.5,
        offsetY: pencilScale*0.5,
        width: pencilScale,
        height: pencilScale,
        rotation: 45,
        fill: fillColor,
      });
    break;
    default:
      pencil = new Konva.Rect({
        x: lastPos.x,
        y: lastPos.y,
        offsetX: pencilScale*0.5,
        offsetY: pencilScale*0.5,
        width: pencilScale,
        height: pencilScale,
        fill: fillColor,
      });
  }
}

function handleDrawPencilClick() {
  drawLayer.removeChildren();
  drawLayer.batchDraw();

  isDrawPencil = ! isDrawPencil;
  
  document.getElementById('drawPencil').classList.toggle('inactive'); // Enable fill image button
  if (isDrawPencil) {
    isBucketMode = false;
    document.getElementById('fillImageButton').classList.add('inactive');
  }
}

// Attach event listeners
stage.on('click', handleStageClick);
stage.on('mousemove', handleStageMouseMove);
stage.on('dblclick', handleStageDblClick);
document.getElementById('fillButton').addEventListener('click', handleFillClick);

document.getElementById('fillImageButton').addEventListener('click', handleFillImageClick);
document.getElementById('fillImageSensitivityButton').addEventListener('input', handleFillImageSensitivityClick);
document.getElementById('fillImageSensitivityLabel').textContent = fillColorSensitivity; // Update global fillColorSensitivity

document.getElementById('drawPencil').addEventListener('click', handleDrawPencilClick);

document.getElementById('drawProtectCheckbox').addEventListener('change', handleDrawProtect);
document.getElementById('drawProtectLabel').textContent = isDrawProtect ? 'active' : 'inactive';

document.getElementById('fillCleanCheckbox').addEventListener('change', handleFillClean);
document.getElementById('fillCleanCheckboxLabel').textContent = isFillClean ? 'active' : 'inactive';
document.getElementById('scalePencilButton').addEventListener('input', handleScalePencil);
document.getElementById('scalePencilLabel').textContent = pencilScale;

document.getElementsByName('pencilShape').forEach(radio => radio.addEventListener('change', handlePencilShape));
//document.querySelector('[name="pencilShape"][value="' + pencilShape + '"]').checked = true;
document.getElementsByName('pencilShape').forEach(radio => {
    if (radio.value === pencilShape) {
        radio.checked = true;
    }
});
document.getElementById('deleteButton').addEventListener('click', handleDeleteClick);
document.getElementById('newPathButton').addEventListener('click', handleNewPathClick);
document.getElementById('uploadImageButton').addEventListener('change', handleImageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update fillColor on change
