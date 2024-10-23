let { width: pwidth, height: pheight } = document.querySelector('#container').style;
// Set up the stage and imageLayer
var stage = new Konva.Stage({
    id: 'stage',
    container: 'container',
    width: parseInt(pwidth) ?? 200,
    height: parseInt(pheight) ?? 100,
});

// Order of layers is important
var imageLayer = new Konva.Layer({
    id: 'image',
});
stage.add(imageLayer);
var bucketLayer = new Konva.Layer({
    id: 'bucket',
});
stage.add(bucketLayer);
var pathLayer = new Konva.Layer({
    id: 'path',
});
stage.add(pathLayer);

var currentImage; // Variable to hold the currently added image

// Variable to store the last clicked position
var lastPos = null;

// Global variable to store the fill color with a default value
var fillColor = '#000000'; // Default fill color (black)

// It controlls sensitivity for flooding image areas with fillColor
var fillColorSensitivity = 25;

// Size of pencil
var pencilSize = 30;

// Function to handle mouse click to add points to the path
function handleBucketMode(kevt) {
    if (!isBucketMode) {
      return true;
    }

    if (kevt.target === stage) return;
    // Event is triggered clicking on a transparent pixel of a flood image
    // Find coresponding image from imageLayer
    if (kevt.target?.parent === bucketLayer) {
        // Check images on imageLayer - beneath bucketLayer
        imageLayer.children.reverse().forEach(img => {
            const { x, y } = img.getRelativePointerPosition();
            const w = img.width();
            const h = img.height();
            const isInside = (0 < x && x < w && 0 < y && y < h);
            if (isInside) {
                fillBucket(img);
            }
        })
        return;
    }

    fillBucket(kevt.target);
    kevt?.evt.stopImmediatePropagation();
}

function handlePathMode(kevt) {
    if (!isDrawPath) {
      return true;
    }

    var pos = stage.getRelativePointerPosition();
    lastPos = pos;

    let currentPath;
    if (!currentPathId) {
        currentPathId = `path${Math.random().toString(36).slice(2)}`;
        currentPath = new Konva.Path({
            data: '',
            stroke: 'green',
            strokeWidth: 3,
            fill: '',
            id: currentPathId,
        });
        pathData = '';
        pathLayer.add(currentPath);
        
        currentPath.on('click', function(evt) {
          evt.cancelBubble = true;
          // Click on unclosed curve does none
          if (this.data().endsWith('Z') === false) {
            return;
          }
          // Another path is currently drawing but we clicked on already closed path
          if (currentPathId !== null && this.getId() !== currentPathId) {
            const previousPath = pathLayer.findOne(`#${currentPathId}`);
            // Prev path is currently drawing
            if (previousPath.data().endsWith('Z') === false) {
              evt.cancelBubble = false;
              return;
            } else {
              // Reset prev path
              previousPath.strokeWidth(0);
              previousPath.draggable(false);
              previousPath.selected = false;
              // Current path is this one closed just clicked
              currentPathId = this.getId();
            }
          }

          if (!currentPathId) {
            currentPathId = this.getId();
          }
          // Reset previous path stroke
          if (currentPathId !== this.getId()) {
            const previousPath = pathLayer.findOne(`#${currentPathId}`);
            previousPath.strokeWidth(0);
            previousPath.draggable(false);
            previousPath.selected = false;
          }

          currentPathId = this.getId(); // Set this path as the current path
          this.selected = !this?.selected;
          if (this?.selected) {
            this.strokeWidth(2);
            this.draggable(true);
          } else {
            this.strokeWidth(0);
            this.draggable(false);
          }
          pathLayer.batchDraw();
          lastPos = null; // Reset last position for drawing

          // Update button states
          document.getElementById('deleteButton').disabled = false; // Enable the delete button
          document.getElementById('fillButton').disabled = false; // Enable the fill button
          document.getElementById('fillColorPicker').disabled = false; // Enable the fill color picker
        });
        currentPath.on('mousedown', function(evt) {
          evt.cancelBubble = true;
          if (isDragging && !this.selected) {
            evt.cancelBubble = false;
          }
        });
        currentPath.on('mouseup', function(evt) {
          evt.cancelBubble = true;
          if (isDragging && !this.selected) {
            evt.cancelBubble = false;
          }
        });
        currentPath.on('mousemove', function(evt) {
          evt.cancelBubble = true;
          if (isDragging && !this.selected) {
            evt.cancelBubble = false;
          }
        });
    } else {
      currentPath = pathLayer.findOne(`#${currentPathId}`);
    }

    // Closed path has no need to add new point
    if (currentPath.data().endsWith('Z')) {
      currentPath.strokeWidth(0);
      currentPath.draggable(false);
      currentPath.selected = false;
      currentPathId = null;
      return;
    }

    if (pathData === '') {
        // M'ove command
        pathData += `M${pos.x},${pos.y}`;
    } else {
        // Add line to ('L') for subsequent clicks
        pathData += ` L${pos.x},${pos.y}`;
    }

    //// Update the path data
    currentPath.setAttr('data', pathData);
    pathLayer.batchDraw();
    kevt.evt.stopImmediatePropagation();
}

// Function to handle mouse move to preview the next segment in real-time
function previewCurrentLine(evt) {
  if (!currentPathId || !lastPos) return; // Don't preview if no path or no previous point
  if (isBucketMode) return;
  if (isDrawPencil) return;
  if (isDragging) return;

  var pos = stage.getRelativePointerPosition();

  // Update the previewLine to preview the line from the last position to the current mouse position
  previewLine.points([lastPos.x, lastPos.y, pos.x, pos.y]);
  pathLayer.batchDraw();
}

// Function to handle double click to close the path
function handleStageDblClick() {
  if (pathData === '') return;
  if (!currentPathId) return;

  // Close the path by adding 'Z' to the SVG path data
  pathData += ' Z';

  const currentPath = pathLayer.findOne(`#${currentPathId}`);
  // Update the path data and set the closed flag
  currentPath.setAttr('data', pathData);

  currentPath.fill(fillColor);
  currentPath.strokeWidth(0);

  resetPathState();

  // Enable the "Fill Path" button and color picker after the path is closed
  document.getElementById('fillButton').disabled = false;
  document.getElementById('fillColorPicker').disabled = false;
  document.getElementById('deleteButton').disabled = false; // Enable delete button

  // Redraw the imageLayer
  pathLayer.batchDraw();
}

// Function to handle the "Fill Path" button click
function handleFillClick() {
  if (!currentPathId) return; // Only allow filling if the path is closed

  const currentPath = pathLayer.findOne(`#${currentPathId}`);
  currentPath.fill(fillColor);
  currentPath.strokeWidth(0);

  pathLayer.batchDraw();
}

// Create a new web worker
const floodFillWorker = new Worker('floodfillWorker.js');

// It control if flood filling is allowed
let isBucketMode = false;

// Function to handle filling the image with the global color using Web Worker
function handleFillImageClick() {
  isBucketMode = !isBucketMode;
  // When filling mode begins it requires you 
  // to choose a starting color (by position) from image
  document.getElementById('fillImageButton').classList.toggle('inactive'); // Enable fill image button
  if (isBucketMode) {
    lastPos = stage.getRelativePointerPosition();
    isDrawPencil = false;
    document.getElementById('drawPencil').classList.add('inactive');
  }
}

function collapseBucketLayer() {
  Konva.autoDrawEnabled = false;

  const { x, y, scaleX, scaleY, width, height, } = stage.attrs;
  const old = { x, y, scaleX, scaleY, width, height };

  const w = bucketLayer.width();
  const h = bucketLayer.height();
  // Reset stage (no skew or rotation)
  stage.setAttrs({
    x: 0, y: 0,
    scaleX: 1, scaleY: 1,
    width: w, height: h,
  });

  const bucketCanvas = bucketLayer.toCanvas();
  const bucketImage = new Konva.Image({
    x: 0, y: 0,
    width: w,
    height: h,
    image: bucketCanvas,
  });

  // Transform back
  stage.setAttrs(old);

  Konva.autoDrawEnabled = true;

  bucketLayer.removeChildren();
  bucketLayer.add(bucketImage);

  return bucketImage;
}

async function fillBucket(currentImage) {
  if (!isBucketMode || !currentImage) return;

  lastClickPos = currentImage.getRelativePointerPosition();

  // Get raw native image behind currentImage
  const imageElement = currentImage.image();
  // Native (unscaled) dimensions of image
  const width = imageElement.width;
  const height = imageElement.height;

  // Get native image data to be sent outside to the worker
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = width;
  imageCanvas.height = height;
  const imageCtx = imageCanvas.getContext('2d');
  // fiil our imageCanvas with native imageElement
  imageCtx.drawImage(imageElement, 0, 0);

  // Get pos on a transformed currentImage (through stage's transformation)
  const localPos = currentImage.getRelativePointerPosition();
  const startPos = {
    x: Math.floor(localPos.x),
    y: Math.floor(localPos.y)
  };

  const bucketImage = await collapseBucketLayer();
  const bucketBmp = await createImageBitmap(bucketImage.image());
  imageCtx.drawImage(bucketBmp, 0, 0,);
  const imageData = imageCtx.getImageData(0, 0, width, height);

  // Send image data and other details to the web worker
  floodFillWorker.postMessage({
    imageData,
    startPos,
    fillColor,
    tolerance: fillColorSensitivity // or any other tolerance value you want
  });

  // Handle the response from the web worker
  floodFillWorker.onmessage = async function(e) {
    // Receive a widthxheight image that has bucket zone surrounded by transparency
    // Image is just to be laid out 
    const { floodImageData, x, y, w, h, } = e.data;

    // Polite mode: take into account already draw pixels
    const floodBmp = await createImageBitmap(floodImageData)

    const floodImage = new Konva.Image({
      x: 0, y: 0,
      width: floodBmp.width,
      height: floodBmp.height,
      image: floodBmp,
      globalCompositeOperation: gco(),
    });
    bucketLayer.add(floodImage);
    bucketLayer.batchDraw(); // Redraw the imageLayer to show the image


    // TODO needless?
    /*bucketImage.on('click', function(e) {
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
    });*/

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
    if (currentPathId) {
      const currentPath = pathLayer.findOne(`#${currentPathId}`);
      currentPath.destroy(); // Remove the current path
      resetPathState(); // Reset drawing state

      // Disable buttons since there's no current path
      document.getElementById('fillButton').disabled = true;
      document.getElementById('fillColorPicker').disabled = true;
      document.getElementById('deleteButton').disabled = true;

      // Clear the temporary line
      previewLine.points([]);
      pathLayer.batchDraw();
    } else if (currentImage) {
      currentImage.destroy(); // Remove the current image
      currentImage = null; // Reset current image variable

      // Disable the delete button since there's no current image
      document.getElementById('deleteButton').disabled = true;
      imageLayer.batchDraw(); // Redraw the imageLayer
    }
}

function handleClearAllClick() {
    pathLayer.removeChildren();
    pathLayer.clear();
    bucketLayer.removeChildren();
    bucketLayer.clear();
}

function handleUndoClick() {
}

function handleRedoClick() {
    console.log(stage.toJSON())
}

// Create a temporary line for the preview (while moving the mouse)
var previewLine = new Konva.Line({
    id: 'previewLine',
    points: [],
    stroke: 'green',
    strokeWidth: 2,
    lineCap: 'round',
    dash: [10, 5], // Dashed line to distinguish from the actual path
});
pathLayer.add(previewLine);

function restorePreviewLine() {
    const foundLine = pathLayer.findOne('#previewLine');
    if (foundLine) {
        return;
    }

    previewLine = new Konva.Line({
        points: [],
        stroke: 'green',
        strokeWidth: 2,
        lineCap: 'round',
        dash: [10, 5], // Dashed line to distinguish from the actual path
    });
    pathLayer.add(previewLine);
}

// Variable to store the current path data
var pathData = '';
var currentPathId = null; // Variable to hold the current path object

// Function to reset drawing state
function resetPathState() {
  currentPathId = null;
  pathData = '';
  lastPos = null;
  previewLine.points([]);
}

var isDrawPath = false;
// Function to handle the "Add New Path" button click
function handleNewPathClick() {
  resetPathState();

  isDrawPath = !isDrawPath;
  if (isDrawPath === false) {
      document.getElementById('newPathButton').classList.add('inactive');
      return;
  }
  isDrawPencil = false;
  document.getElementById('newPathButton').classList.remove('inactive');
  document.getElementById('drawPencil').classList.add('inactive');
  // Disable the fill button, color picker, and delete button since we are starting a new path
  document.getElementById('fillButton').disabled = true;
  document.getElementById('fillColorPicker').disabled = true;
  document.getElementById('deleteButton').disabled = true;
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
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {

      const { width: pwidth, height: pheight } = document.querySelector('#container').style;
      const stageApparentWidth = parseInt(pwidth); //stage.width();
      const stageApparentHeight = parseInt(pheight); //stage.height();
      const imgWidth = img.width;
      const imgHeight = img.height;

      // Calculate aspect ratios
      const stageAspectRatio = stageApparentWidth / stageApparentHeight;
      const imgAspectRatio = imgWidth / imgHeight;

      // Determine how to scale the image to fit within the stage
      let newWidth, newHeight;
      if (imgAspectRatio > stageAspectRatio) {
        // Image is wider than the stage, scale by width
        newWidth = stageApparentWidth;
        newHeight = (imgHeight * stageApparentWidth) / imgWidth;
      } else {
        // Image is taller than the stage, scale by height
        newHeight = stageApparentHeight;
        newWidth = (imgWidth * stageApparentHeight) / imgHeight;
      }
      // Calculate the scaling factors
      imageScaleX = newWidth / imgWidth; // Scale factor for the width
      imageScaleY = newHeight / imgHeight; // Scale factor for the height
      // FIXME
      stage.width(img.width)
      stage.height(img.height)
      stage.container().querySelector('* > div').style.transform = `scale(${Math.max(imageScaleX, imageScaleY)})`;
      const allLayers = [imageLayer, bucketLayer, pathLayer];
      for (const layer of allLayers) {
        // Remove including non-drawing preview line 
        layer.destroyChildren()
      }
      // Add back preview line
      restorePreviewLine();

      const newImage = new Konva.Image({
        image: img,
      });
      imageLayer.add(newImage);

      newImage.on('click', function(evt) {
        const pos = stage.getRelativePointerPosition();
        lastClickPos = pos;
        document.getElementById('deleteButton').disabled = false; // Enable delete button
      });

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

// Maps interval [0, 1] to [0, 500]
// and finds where 100 of [0, 500] will be on [0, 1]
const ZOOM_MAX = 1000; // zoom in 1000/100 times 
let zoomScale = zoomInterval(100, 0, ZOOM_MAX, 0, 1);
let zoomFactor = 0.001;
function zoomInterval(x, inMin = 0, inMax = 1, outMin = -800, outMax = 800) {
    return outMin + (x - inMin) * (outMax - outMin) / (inMax - inMin);
}
// The inverse of zoomInterval
// Finds where v of [0, 1] is on [0, 500]
// just for showing on UI a human friendly value of scaling
const mapZoom = v => {
    return zoomInterval(v, 0, 1, 0, ZOOM_MAX);
};

function handleZoom(evt) {
    const z = parseFloat(evt.target.value); // Get the zoom scale
    if (z <= 0) return;
    zoomScale = mapZoom(z, 0, 1, 0, ZOOM_MAX) / 100
    // Get the pointer position relative to the stage
    let stageCenter = {
        x: stage.width() / 2,
        y: stage.height() / 2
    };

    let oldScale = stage.scaleX(); // Current scale of the stage
    // Get the current position of the stage
    let oldPosition = stage.position();

    // Scale the stage (uniformly for both x and y)
    // TODO copy here bucker and draw before they are posibly altered by zoom
    stage.scale({ x: zoomScale, y: zoomScale });

    // Calculate the new position after zooming, to keep the center in the same place
    let newPos = {
        x: stageCenter.x - (stageCenter.x - oldPosition.x) * (zoomScale / oldScale),
        y: stageCenter.y - (stageCenter.y - oldPosition.y) * (zoomScale / oldScale)
    };

    // Apply the new position to the stage
    stage.position(newPos);

    // Update the stage
    stage.batchDraw();

    document.getElementById('zoomButton').value = z;
    document.getElementById('zoomButtonLabel').textContent = mapZoom(z);
}

function handleFillImageSensitivityClick() {
  fillColorSensitivity = document.getElementById('fillImageSensitivityButton').value; // Update global fillColor
  document.getElementById('fillImageSensitivityLabel').textContent = fillColorSensitivity; // Update global fillColorSensitivity
}

function adjustPencilCenter() {
  if (pencilShape !== 'circle') {
    pencil.setAttrs({
      offsetX: pencilSize * 0.5,
      offsetY: pencilSize * 0.5,
    });
  }
}

function handleScalePencil() {
  pencilSize = document.getElementById('scalePencilButton').value;
  if (pencil) {
    pencil.setAttrs({ width: pencilSize, height: pencilSize });
    adjustPencilCenter();
  }
  document.getElementById('scalePencilLabel').textContent = pencilSize;
}

let pencil;
let isDrawPencil = false;
let mousemove = false;

function gco() {
    const v = isFillClean ? 'destination-out' : (isDrawProtect ? 'destination-over' : 'source-over');
    return v;
}
// Mousedown event starts drawing with pencil
stage.on('mousedown', (evt) => {
  if (!isDrawPath && currentPathId) {
    const p = pathLayer.findOne(`#${currentPathId}`);
    // Prev path is currently drawing
    if (p.data().endsWith('Z') === true) {
      // Reset prev path
      p.strokeWidth(0);
      p.draggable(false);
      p.selected = false;
    }
    resetPathState();
  }

  // Must be first
  const pos = stage.getRelativePointerPosition();
  lastPos = pos;

  if (isDragging === true) {
    stage.startDrag();
    return;
  }
  if (!isDrawPencil) {
    return true;
  }

  evt.cancelBubble = true;
  mousemove = true;

  if (pencil) {
    pencil.width(pencilSize);
    pencil.height(pencilSize);
    adjustPencilCenter();
  } else {
    const ps = Array.from(document.getElementsByName('pencilShape')).filter(x => x.checked).pop()?.value ?? 'rectangle';
    createPencilShape(ps);
  }
  pencil.globalCompositeOperation(gco());

  const cloned = pencil.clone({
    x: pos.x, y: pos.y,
    id: 'pencilGhost',
    fill: 'transparent', stroke: fillColor, strokeWidth: 2,
    globalCompositeOperation: 'source-over',
  });
  bucketLayer.add(cloned);
});

const collapseDraw = (evt) => {
    // Is a natural-browser event - not artificially generated ?
    if (evt.composed) {
        mousemove = false;
        pencilPrevPos = null;
        return;
    }
    if (!isDrawPencil) return;
    if (!pencil) return;
    if (isDragging) return;

    collapseBucketLayer();
};

// Mouseup event finalizes the shape
// FIXME Just to comfirm that I am guilty of stupidity
//document.body.addEventListener('click', () => console.log('document click'));
document.body.addEventListener('mouseup', collapseDraw);
stage.on('mouseup', (kevt) => {
    mousemove = false;
    pencilPrevPos = null;

    if (isDragging === true) {
        stage.stopDrag();
    }

    kevt?.evt?.stopImmediatePropagation();
    if (kevt?.evt?.cancelBubble) {
        kevt.evt.cancelBubble = true;
    }
    //
    if (!isBucketMode) {
        const pencilGhost = stage.findOne('#pencilGhost');
        if (pencilGhost) {
            pencilGhost.destroy();
        }
        // TODO will affect other ops than shape-ing?
        if (isDrawPencil) {
          collapseBucketLayer();
        }
    }
});
stage.on('mouseleave', (evt) => {
    mousemove = false;
    pencilPrevPos = null;
    const pencilGhost = stage.findOne('#pencilGhost');
    if (pencilGhost) {
        pencilGhost.destroy();
    }
    collapseDraw(evt);
});

function directionAngle(dx, dy) {
  const radians = Math.atan2(dx, dy);
  // Compensate how JS references angle measurement 
  // with how this it is done in canvas's context
  let grades = 90-radians*(180/Math.PI);
  return [grades, radians];
}

let pencilPrevPos = null;
// Mousemove event is cloning
// Draw on stage using pencil
stage.on('mousemove', (evt) => {
    if (!mousemove && evt.target?.attrs?.id === 'stage') {
        return;
    }
    if (!isDrawPencil) return;
    if (!mousemove) return;
    if (!pencil) return;
    if (isDragging) return;

    evt.cancelBubble = true;

    // Get the current mouse position
    let pos = stage.getRelativePointerPosition();

    if (pencilPrevPos) {
      // Calculate the total distance between the two points
      const distanceX = pos.x - pencilPrevPos.x;
      const distanceY = pos.y - pencilPrevPos.y;
      // angle
      const [ang] = directionAngle(distanceX, distanceY);
      const MIN_NIB = 5;
      let numRectangles = MIN_NIB;

      const a = Math.abs(distanceX);
      const b = Math.abs(distanceY);
      const c = Math.sqrt(a ** 2 + b ** 2);
      if (c < pencilSize/MIN_NIB) {
        return;
      } 
      if (c < pencilSize) {
        numRectangles = MIN_NIB;
      } 

      adjustPencilCenter();
      const rot = pencil.rotation(); // rotation is cummulative
      const diffAng = ang - rot%360;
      pencil.rotate(diffAng);

      numRectangles = MIN_NIB*Math.ceil(c / pencilSize);
      // Calculate the step for each rectangle along the line
      // Place rectangles at evenly spaced positions
      const stepX = distanceX/numRectangles;
      const stepY = distanceY/numRectangles;
      for (let i = 1; i <= numRectangles; i++) {
        const x = pencilPrevPos.x + i*stepX;
        const y = pencilPrevPos.y + i*stepY;

        if (isFillClean && pencil) {
          pencil.fill('#FFFFFF');
        }
        const cloned = pencil.clone({
          x, y,
        });
        bucketLayer.add(cloned);

        pos = { x, y };
      }
      pencilPrevPos = pos;
    }

    if (isFillClean && pencil) {
      pencil.fill('#FFFFFF');
    }
    if (!pencilPrevPos) {
      pencilPrevPos = pos;
    }

    bucketLayer.batchDraw();
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

let isDragging = false;

function handleDragging() {
    isDragging = !isDragging;
    document.getElementById('isDraggingCheckbox').checked = isDragging;
    document.getElementById('isDraggingCheckboxLabel').textContent = isDragging ? 'active' : 'inactive';
}

let pencilShape = 'rectangle';

function handlePencilShape(evt) {
    pencilShape = evt.target.value;
    createPencilShape(pencilShape);
}

function createPencilShape(pencilShape = 'rectangle') {
    switch (pencilShape) {
        case 'circle':
            pencil = new Konva.Circle({
                offsetX: 0,
                offsetY: 0,
                width: pencilSize,
                height: pencilSize,
                fill: fillColor,
            });
            break;
        case 'rhomb':
            pencil = new Konva.Rect({
                offsetX: pencilSize * 0.5,
                offsetY: pencilSize * 0.5,
                width: pencilSize,
                height: pencilSize,
                rotation: 45,
                fill: fillColor,
            });
            break;
        default:
            pencil = new Konva.Rect({
                offsetX: pencilSize * 0.5,
                offsetY: pencilSize * 0.5,
                width: pencilSize,
                height: pencilSize,
                fill: fillColor,
            });
    }
}

function handleDrawPencilClick() {
  isDrawPencil = !isDrawPencil;
  if (isDrawPencil) {
    isBucketMode = false;
    isDrawPath = false;
    isDragging = false;
    stage.stopDrag();

    document.getElementById('isDraggingCheckbox').checked = isDragging;
    document.getElementById('isDraggingCheckboxLabel').textContent = 'inactive';

    document.getElementById('fillImageButton').classList.add('inactive');
    document.getElementById('newPathButton').classList.add('inactive');
  }

  document.getElementById('drawPencil').classList.toggle('inactive'); // Enable fill image button
}

function debug(canvas) {
  if ([HTMLImageElement].includes(canvas.constructor)) {
    document.body.appendChild(canvas)
    return
  }
  if ([ImageBitmap].includes(canvas.constructor)) {
    const imageBitmap = canvas;
    var canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    var ctx = canvas.getContext('2d');
    // 2. Draw the ImageBitmap onto the canvas
    ctx.drawImage(imageBitmap, 0, 0);
    // 3. Convert the canvas content to a data URL or Blob
    var dataURL = canvas.toDataURL();  // Option 1: Using data URL
    // var blob = await new Promise(resolve => canvas.toBlob(resolve));  // Option 2: Using Blob (for larger images)
    // 4. Create a new Image object
    var newImage = new Image();
    newImage.src = dataURL;
    document.body.appendChild(newImage)
    return
  }
  const tpl = `<div style="position: relative">
  <canvas/>
</div>`;
  document.body.insertAdjacentHTML('beforeend', tpl);
  const el = document.body.lastElementChild.firstElementChild;
  canvas.style = "";
  el.parentNode.replaceChild(canvas, el);
}

// Attach event listeners
stage.on('click', handleBucketMode);
stage.on('click', handlePathMode);
stage.on('mousemove', previewCurrentLine);
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
document.getElementById('scalePencilLabel').textContent = pencilSize;

document.getElementsByName('pencilShape').forEach(radio => radio.addEventListener('change', handlePencilShape));
//document.querySelector('[name="pencilShape"][value="' + pencilShape + '"]').checked = true;
document.getElementsByName('pencilShape').forEach(radio => {
    if (radio.value === pencilShape) {
        radio.checked = true;
    }
});

document.getElementById('zoomButton').addEventListener('input', handleZoom);
document.getElementById('zoomButton').setAttribute('step', zoomFactor);
document.getElementById('zoomButton').value = zoomScale;
document.getElementById('zoomButtonLabel').textContent = mapZoom(zoomScale);

document.getElementById('isDraggingCheckbox').addEventListener('change', handleDragging);
document.getElementById('isDraggingCheckboxLabel').textContent = isDragging ? 'active' : 'inactive';

document.getElementById('deleteButton').addEventListener('click', handleDeleteClick);
document.getElementById('clearAllButton').addEventListener('click', handleClearAllClick);
document.getElementById('undoButton').addEventListener('click', handleUndoClick);
document.getElementById('redoButton').addEventListener('click', handleRedoClick);
document.getElementById('newPathButton').addEventListener('click', handleNewPathClick);
document.getElementById('uploadImageButton').addEventListener('change', handleImageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update fillColor on change
