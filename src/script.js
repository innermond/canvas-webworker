import {stage, imageLayer, bucketLayer, justContourLayer} from '@/init/layers';
import {imageTransformer} from '@/init/layers';
import '@/init/create-dofuncs';
import {is, mode} from '@/modes';
import {previewLine} from '@/previewline'; 
import {doSelectStart, doSelectEnd, doSelectFinal, doSelecting} from '@/selecting';
import {animation01} from '@/animation';
import {currentPathId, setCurrentPathId, doDrawPathing, handleStageDblClick, resetPathState, } from '@/path';
import {destroyHandleCircles, } from '@/path/handle-circles';
import {lastPos, setLastPos} from '@/last-position';
import {color, node, selection} from '@/vars';

var currentImage; // Variable to hold the currently added image
// Global variable to store the fill color with a default value
// It controlls sensitivity for flooding image areas with color.fill
// Size of pencil
var pencilSize = 30;

function handleBucketMode(kevt) {
  if (!is.bucket) {
    return;
  }

  if (kevt.target === stage) return;

  setLastPos();
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

function doChangeNodePathClick() {
  if (! currentPathId) {
    is.changeNodePath = false;
    document.getElementById('doChangeNodePath').classList.add('inactive');
    return;
  }
  if (is.changeNodePath) {
    document.getElementById('doDrawPath').classList.add('inactive');
    document.getElementById('doDeleteNodePath').classList.add('inactive');
  }
  document.getElementById('doChangeNodePath').classList[is.changeNodePath ? 'remove' : 'add']('inactive');
}

function handleMagneticNodeClick() {
  if (!currentPathId) return;

  node.isMagnetic = ! node.isMagnetic;

  document.getElementById('doMagneticNode').checked = node.isMagnetic;
}

// Function to handle the "Fill Path" button click
function doFillClick() {
  if (!currentPathId) return;
  const currentPath = imageLayer.findOne(`#${currentPathId}`);

  currentPath.fill(color.fill);
  currentPath.globalCompositeOperation(color.blend);
  currentPath.strokeWidth(0);

  imageLayer.batchDraw();

  document.getElementById('doFill').classList.remove('inactive');
}

// Create a new web worker
const floodFillWorker = new Worker('floodfillWorker.js');

  // Handle the response from the web worker
floodFillWorker.onmessage = async function(e) {
  // Receive a widthxheight image that has bucket zone surrounded by transparency
  // Image is just to be laid out 
  const { justContour, floodImageData, x, y, w, h, } = e.data;

  // Polite mode: take into account already draw pixels
  const floodBmp = await createImageBitmap(floodImageData)
  const floodImage = new Konva.Image({
    x: 0, y: 0,
    width: floodBmp.width,
    height: floodBmp.height,
    image: floodBmp,
    globalCompositeOperation: gco(),
  });

  if ( ! justContour) {
    currentImage = floodImage;
    bucketLayer.add(floodImage);
    bucketLayer.batchDraw();
  } else {
    floodImage.setAttr('id', 'floodImageContour');
    justContourLayer.add(floodImage);
    justContourLayer.batchDraw();

    animation01(() => {
      if ( ! floodImage?.parent) {
        return true;
      }
      return false;
    }, (applyInvert) => {
      if (applyInvert) {
        floodImage.cache();
        floodImage.filters([Konva.Filters.Invert]);
      } else {
        floodImage.clearCache();
        floodImage.filters([]);
      }
    });
  }

  document.getElementById('fillSelectionImageButton').classList.remove('inactive');
  document.getElementById('doDelete').disabled = false;
};

async function fillSelectionImageClick() {
  if (is.magikWand === false) {
    return;
  }
  await fillSelectionImage(false);
}

async function fillSelectionImage(justContour=false) {
  if (lastPos) {
    const {x, y} = lastPos;
    const startPos = {
      x: Math.round(x),
      y: Math.round(y),
    };
    removeSelection();
    const img = getAsRawImage(stage);
    const imageData = await getImageDataComposedWithBucket(img);
    const msg = {
      imageData,
      startPos,
      fillColor: color.fill,
      tolerance: color.sensitivity,
    };
    if (justContour) {
      msg.justContour = true;
    }
    floodFillWorker.postMessage(msg);
  }
}

function removeSelection(e) {
  document.getElementById('fillSelectionImageButton').classList.add('inactive');
  if (is.addNodePath) {
    is.addNodePath = false;
    document.getElementById('doAddNodePath').classList.add('inactive');
  }
  if (is.deleteNodePath) {
    is.deleteNodePath = false;
    document.getElementById('doDeleteNodePath').classList.add('inactive');
  }
  if (is.changeNodePath) {
    is.changeNodePath = false;
    document.getElementById('doChangeNodePath').classList.add('inactive');
  }

  const a = justContourLayer.children.length;
  if (a > 0) {
    justContourLayer.destroyChildren();
    justContourLayer.batchDraw();
  }

  if (e?.target === stage) {
    selection.forEach(v => {
      v.strokeWidth(0);
      v.draggable(false);
      v.selected = false;
      setCurrentPathId(v.id());
      destroyHandleCircles();
    })
    selection.clear();
    //setCurrentPathId(null);
    imageTransformer.nodes([]);
  }
}

function handleSelectMode(kevt) {
  if (!is.magikWand) {
    return true;
  }
  if (kevt.target === stage) return;

  setLastPos();
  fillSelectionImage(true);
  kevt?.evt.stopImmediatePropagation();
}

function getAsRawImage(layer) {
  Konva.autoDrawEnabled = false;

  const { x, y, scaleX, scaleY, width, height, } = stage.attrs;
  const old = { x, y, scaleX, scaleY, width, height };

  const w = layer.width();
  const h = layer.height();
  // Reset stage (no skew or rotation)
  stage.setAttrs({
    x: 0, y: 0,
    scaleX: 1, scaleY: 1,
    width: w, height: h,
  });

  const canvas = layer.toCanvas();
  const image = new Konva.Image({
    x: 0, y: 0,
    width: w,
    height: h,
    image: canvas,
  });

  // Transform back
  stage.setAttrs(old);

  Konva.autoDrawEnabled = true;

  return image;
}

function collapseBucketLayer() {
  const bucketImage = getAsRawImage(bucketLayer);
  bucketLayer.destroyChildren();
  bucketLayer.add(bucketImage);

  return bucketImage;
}
function collapseStroke() {
  if (bucketLayer.children.length === 0) return;
  const bucketImage = getAsRawImage(bucketLayer);
  bucketLayer.destroyChildren();
  bucketImage.globalCompositeOperation(gco());
  imageLayer.add(bucketImage);
}

async function getImageDataComposedWithBucket(kimage) {
  // Get raw native image behind currentImage
  const imageElement = kimage.image();
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

  const bucketImage = getAsRawImage(bucketLayer);
  const bucketBmp = await createImageBitmap(bucketImage.image());
  imageCtx.drawImage(bucketBmp, 0, 0,);
  const imageData = imageCtx.getImageData(0, 0, width, height);

  return imageData;
}

async function fillBucket(cobaiImage) {
  const bucketOrSelectImage = is.bucket || is.magikWand;
  if (!bucketOrSelectImage || !cobaiImage || !cobaiImage?.parent) return;

  lastClickPos = cobaiImage.getRelativePointerPosition();

  // Get raw native image behind currentImage
  const imageElement = cobaiImage.image();
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
  const localPos = cobaiImage.getRelativePointerPosition();
  const startPos = {
    x: Math.round(localPos.x),
    y: Math.round(localPos.y),
  };

  const bucketImage = await collapseBucketLayer();
  const bucketBmp = await createImageBitmap(bucketImage.image());
  imageCtx.drawImage(bucketBmp, 0, 0,);
  const imageData = imageCtx.getImageData(0, 0, width, height);

  // Send image data and other details to the web worker
  floodFillWorker.postMessage({
    imageData,
    startPos,
    fillColor: color.fill,
    tolerance: color.sensitivity,
    justContour: is.magikWand,
  });

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

    // Extract RGB components
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    // Check if there's an alpha channel
    const alpha = hex.length === 9 ? ((bigint >> 24) & 255) / 255 : 1; // Default alpha = 1

    return { r, g, b, a: alpha };
}

// Helper function to convert RGB to hex
function rgbToHex(r, g, b, a = 1) {
    // Ensure RGB values are within [0, 255]
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    // Convert alpha (0.0–1.0) to 0–255 range and ensure it's within bounds
    const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255);

    // Combine components into a single HEX string
    const hex = ((r << 16) + (g << 8) + b).toString(16).padStart(6, "0"); // RGB part
    const alphaHex = alpha.toString(16).padStart(2, "0"); // Alpha part

    return a < 1 ? `#${hex}${alphaHex}` : `#${hex}`; // Add alpha only if it's less than 1
}

// Helper function to parse hex color
function parseColor(color) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const a = parseInt(color.slice(7, 9), 16);
    return { r, g, b, a };
}

// Function to handle the "Delete" button click
function handleDeleteClick() {
    if (currentPathId) {
      destroyHandleCircles();
      const currentPath = imageLayer.findOne(`#${currentPathId}`);
      currentPath.destroy(); // Remove the current path
      imageLayer.find(currentPathId).forEach(c => c.destroy());
      resetPathState(); // Reset drawing state

      imageTransformer.nodes([]);

      // Disable buttons since there's no current path
      document.getElementById('doFill').disabled = true;
      document.getElementById('color.fillPicker').disabled = true;
      document.getElementById('doDelete').disabled = true;

      // Clear the temporary line
      imageLayer.batchDraw();
    } else if (currentImage) {
      currentImage.destroy(); // Remove the current image
      currentImage = null; // Reset current image variable

      imageTransformer.nodes([]);

      // Disable the delete button since there's no current image
      document.getElementById('doDelete').disabled = true;
      imageLayer.batchDraw(); // Redraw the imageLayer
    }
}

function handleClearAllClick() {
  const all = [imageLayer, justContourLayer, bucketLayer];
  all.forEach(l => {
    l.removeChildren();
    l.clear();
  });

  setCurrentPathId(null);
  currentImage?.destroy();
  currentImage =null;
}

function doDropShapeClick() {
  if (! currentPathId) {
    return;
  }

  const currentPath = imageLayer.findOne(`#${currentPathId}`);
  if (! currentPath) {
    return;
  }

  currentPath.strokeWidth(0);
  destroyHandleCircles();
  bucketLayer.add(currentPath);
  collapseBucketLayer();
  resetPathState();
}

function doDropShapeAllClick() {
  for (let i=0; i < imageLayer.children.length; i++) {
    const p = imageLayer.children[i];
    if (p.getId() === 'previewLine') {
      continue;
    }
    p.strokeWidth(0);
    bucketLayer.add(p);
    i--;
  };
  collapseBucketLayer();
  resetPathState();
  imageLayer.batchDraw();
  bucketLayer.batchDraw();
}

function handleNewPathClick() {
  resetPathState();

  is.drawPath = !is.drawPath;
  if (is.drawPath === false) {
    document.getElementById('doDrawPath').classList.add('inactive');
    return;
  }

  document.getElementById('doDrawPencil').classList.add('inactive');
  document.getElementById('doMagikWand').classList.add('inactive');
  document.getElementById('doBucket').classList.add('inactive');
  document.getElementById('doDrawPath').classList.remove('inactive');
  // Disable the fill button, color picker, and delete button since we are starting a new path
  document.getElementById('doFill').disabled = true;
  document.getElementById('color.fillPicker').disabled = true;
  document.getElementById('doDelete').disabled = true;
}

function doAddNodePathClick() {
  if (! currentPathId) {
    is.addNodePath = false;
    document.getElementById('doAddNodePath').classList.add('inactive');
    return;
  }
  document.getElementById('doAddNodePath').classList[is.addNodePath ? 'remove' : 'add']('inactive');
}

function doDeleteNodePathClick() {
  if (! currentPathId) {
    is.deleteNodePath = false;
    document.getElementById('doDeleteNodePath').classList.add('inactive');
    return;
  }

  if (is.deleteNodePath) {
    document.getElementById('doDrawPath').classList.add('inactive');
    document.getElementById('doChangeNodePath').classList.add('inactive');
  }
  document.getElementById('doDeleteNodePath').classList[is.deleteNodePath ? 'remove' : 'add']('inactive');
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
      //const allLayers = [imageLayer, bucketLayer, imageLayer];
      //for (const layer of allLayers) {
      //  // Remove including non-drawing preview line 
      //  layer.destroyChildren()
      //}
      // Add back preview line
      //restorePreviewLine();

      const newImage = new Konva.Image({
        image: img,
      });
      imageLayer.add(newImage);
      previewLine.zIndex(imageLayer.children.length-1);

      newImage.on('mousedown', function(e) {
        if (is.magikWand) return;
        if (is.drawPencil) return; 
        if (is.select) return; 
        e.target.startDrag();
        if (is.bucket) {
          e.target.stopDrag();
        }
      });
      newImage.on('mouseup', function(e) {
        if (is.select) return; 
        e.target.stopDrag();
        if (is.bucket) return; 
        if (is.drawPath) return; 
        if (is.drawPencil) return; 
        if (is.select) return; 
        if (is.drag) return; 
        
        imageTransformer.nodes([]);
        const inx = imageTransformer.nodes().indexOf(e.target);
        if (inx === -1) { // not found exclusively add it
          imageTransformer.nodes([]);
          imageTransformer.nodes([e.target]);
        } else { // found remove it
          const nodes = imageTransformer.nodes().slice();
          nodes.splice(inx, 1);
          imageTransformer.nodes(nodes);
        }
      });
      newImage.on('click', function(e) {
        if (is.drawPath) return;
        if (is.select) return; 

        e.evt.preventDefault();

        currentImage = e.target;
        setCurrentPathId(null);

        const pos = stage.getRelativePointerPosition();
        lastClickPos = pos;
        
        document.getElementById('doDelete').disabled = false; // Enable delete button
      });
      //newImage.on('transform', function(e) {
      //  const c = justContourLayer.findOne('#floodImageContour');
      //  if (!c) return;
      //  const her = c.getAbsoluteTransform();
      //  const me = e.target.getAbsoluteTransform();
      //  const our = me.multiply(her);
      //  console.log(our.decompose())
      //  e.target.setAttrs(our.decompose());
      //});

      imageLayer.batchDraw(); // Redraw the imageLayer to show the image

      document.getElementById('doDelete').disabled = false; // Enable delete button after image is added
    };
    img.src = event.target.result; // Set image source to the file's data URL
  };

  reader.readAsDataURL(file); // Read the file as a data URL
}

// Function to handle color picker change
function handleColorPickerChange(e) {
  color.fill = e.target.value; // Update global color.fill
  const alpha = Math.round(255*color.opacity/100).toString(16).padStart(2, '0')
  color.fill = color.fill.slice(0, 7) + alpha; 
  if (pencil) {
    pencil.fill(color.fill);
  }
}

function handleOpacityChange(e) {
  color.opacity = e.target.value;
  const alpha = Math.round(255*color.opacity/100).toString(16).padStart(2, '0')
  color.fill = color.fill.slice(0, 7) + alpha; 
  if (pencil) {
    pencil.fill(color.fill);
  }
}

function handleBlendColor(e) {
  color.blend = e.target.value;
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
    stage.scale({ x: zoomScale, y: zoomScale });

    // Calculate the new position after zooming, to keep the center in the same place
    let newPos = {
        x: stageCenter.x - (stageCenter.x - oldPosition.x) * (zoomScale / oldScale),
        y: stageCenter.y - (stageCenter.y - oldPosition.y) * (zoomScale / oldScale)
    };

    stage.position(newPos);
    stage.batchDraw();

    document.getElementById('zoomButton').value = z;
    document.getElementById('zoomButtonLabel').textContent = mapZoom(z);
}

function handleFillImageSensitivityClick() {
  color.sensitivity = document.getElementById('fillImageSensitivityButton').value; // Update global color.fill
  document.getElementById('fillImageSensitivityLabel').textContent = color.sensitivity; // Update global color.sensitivity
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
let mousemove = false;

function gco() {
    const v = isFillClean ? 'destination-out' : (isDrawProtect ? 'destination-over' : color.blend);
    return v;
}
// Mousedown event starts drawing with pencil
stage.on('mousedown', (evt) => {
  if (is.deleteNodePath || is.changeNodePath) {
    return;
  }

  if (!is.drawPath && currentPathId) {
    const p = imageLayer.findOne(`#${currentPathId}`);
    // Prev path is currently drawing
    if (false === is.addNodePath && p.data().endsWith('Z') === true && p.selected === true) {
      // Reset prev path
      p.strokeWidth(0);
      p.draggable(false);
      p.selected = false;
      destroyHandleCircles();
    }
  }
});

const collapseDraw = (evt) => {
  // Is a natural-browser event - not artificially generated ?
  if (evt.composed) {
    mousemove = false;
    pencilPrevPos = null;
    return;
  }
  if (!is.drawPencil) return;
  if (!pencil) return;
  if (is.drag) return;

  collapseBucketLayer();
};

// Mouseup event finalizes the shape
document.body.addEventListener('mouseup', evt => {
  if (!evt.composed) return;
  mousemove = false;
  pencilPrevPos = null;
});
stage.on('mouseup', (kevt) => {
  mousemove = false;
  pencilPrevPos = null;

  //kevt?.evt?.stopImmediatePropagation();
  //if (kevt?.evt?.cancelBubble) {
  //  kevt.evt.cancelBubble = true;
  //}
  document.body.style.cursor = 'default';
});
stage.on('mouseleave', () => {
  mousemove = false;
  pencilPrevPos = null;
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
  if (!is.drawPencil) return;
  if (!mousemove) return;
  if (!pencil) return;
  if (is.drag) return;

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
        pencil.fill(color.fill);
    }
    document.getElementById('fillCleanCheckbox').checked = isFillClean;
    document.getElementById('fillCleanCheckboxLabel').textContent = isFillClean ? 'active' : 'inactive';
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
        fill: color.fill,
      });
      break;
    case 'rhomb':
      pencil = new Konva.Rect({
        offsetX: pencilSize * 0.5,
        offsetY: pencilSize * 0.5,
        width: pencilSize,
        height: pencilSize,
        rotation: 45,
        fill: color.fill,
      });
      break;
    default:
      pencil = new Konva.Rect({
        offsetX: pencilSize * 0.5,
        offsetY: pencilSize * 0.5,
        width: pencilSize,
        height: pencilSize,
        fill: color.fill,
      });
  }
  pencil.setAttr('name', 'pencil');
}

function doDrawPencilClick() {
  removeSelection();

  if (is.drawPencil === false ) {
    document.getElementById('doDrawPencil').classList.add('inactive');
    return;
  }

  stage.stopDrag();

  document.getElementById('doBucket').classList.add('inactive');
  document.getElementById('doDrawPath').classList.add('inactive');
  document.getElementById('doMagikWand').classList.add('inactive');

  document.getElementById('doDrawPencil').classList.remove('inactive');
}
function debug(canvas) {
  const el = document.querySelector('#debug > *:first-child');
  canvas.style = "";
  
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
    el.parentNode.replaceChild(newImage, el);
    return
  }

  const cloned = canvas.cloneNode(true);
  cloned.id += 'cloned';
  
  if ([HTMLImageElement].includes(canvas.constructor)) {
    el.parentNode.replaceChild(cloned, el);
    return
  }
  if ([HTMLCanvasElement].includes(canvas.constructor)) {
    el.parentNode.replaceChild(cloned, el);
    return
  }
  
  const img = canvas.image().cloneNode(true);
  img.id += 'cloned';
  el.parentNode.replaceChild(img, el);
}

function handleUp() {
  if (!currentPathId) {
    return
  }
  const currentPath = imageLayer.findOne(`#${currentPathId}`);
  if (!currentPath.selected) {
    return;
  }

  const z = currentPath.getZIndex();
  currentPath.setZIndex(z+1);
}

function handleDown() {
  if (!currentPathId) {
    return
  }
  const currentPath = imageLayer.findOne(`#${currentPathId}`);
  if (!currentPath.selected) {
    return;
  }

  const z = currentPath.getZIndex();
  currentPath.setZIndex(z-1);
}

function inactivateModes(except='') {
  setCurrentPathId(null);
  currentImage = null;
  mode.value = 0;

  const modes = [
    'doFill',
    'doMagikWand',
    'fillSelectionImageButton',
    'doBucket',
    'doDrawPencil',
    'upz',
    'downz',
    'doDelete',
    'doDropShape',
    'doAddNodePath',
    'doChangeNodePath',
    'doDeleteNodePath',
  ];

  modes.forEach(m => document.getElementById(m).classList.add('inactive'));
}

// select mode
stage.on('mousedown', doSelectStart);
stage.on('mouseup', doSelectEnd);
document.body.addEventListener('mouseup', doSelectEnd);
stage.on('mousemove', doSelecting);
stage.on('click', doSelectFinal);
// drag mode
stage.on('mousedown', (e) => {
  if (!is.drag) return;
  e.cancelBubble = true;

  stage.startDrag();
  document.body.style.cursor = 'grab';
});
stage.on('mouseup', (e) => {
  if (!is.drag) return;
  e.cancelBubble = true;

  stage.stopDrag();
  document.body.style.cursor = 'inherit';
});
stage.on('click', (e) => {
  if (!is.drag) return;
  e.cancelBubble = true;
});
// drawPencil mode
stage.on('mousedown', e => {
  if (!is.drawPencil) return;
  e.cancelBubble = true;

  const pos = stage.getRelativePointerPosition();
  setLastPos(pos);
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
    fill: 'transparent', stroke: color.fill, strokeWidth: 1,
    globalCompositeOperation: 'source-over',
  });
  bucketLayer.add(cloned);
});
stage.on('mouseup mouseleave', (e) => {
  if (!is.drawPencil) return;
  e.cancelBubble = true;

  const pencilGhost = bucketLayer.findOne('#pencilGhost');
  if (pencilGhost) {
    pencilGhost.destroy();
  }
  collapseStroke();
});
stage.on('click', removeSelection);
stage.on('click', handleSelectMode);
stage.on('click', handleBucketMode);
stage.on('click', doDrawPathing);
stage.on('dblclick', handleStageDblClick);

document.getElementById('doFill').addEventListener('click', doFillClick);

document.getElementById('fillSelectionImageButton').addEventListener('click', fillSelectionImageClick);
document.getElementById('fillImageSensitivityButton').addEventListener('input', handleFillImageSensitivityClick);
document.getElementById('fillImageSensitivityLabel').textContent = color.sensitivity; // Update global color.sensitivity

document.getElementById('doDrawPencil').addEventListener('click', doDrawPencilClick);

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

document.getElementById('upz').addEventListener('click', handleUp);
document.getElementById('downz').addEventListener('click', handleDown);

document.getElementById('zoomButton').addEventListener('input', handleZoom);
document.getElementById('zoomButton').setAttribute('step', zoomFactor);
document.getElementById('zoomButton').value = zoomScale;
document.getElementById('zoomButtonLabel').textContent = mapZoom(zoomScale);

document.getElementById('doDelete').addEventListener('click', handleDeleteClick);
document.getElementById('doDeleteAll').addEventListener('click', handleClearAllClick);
document.getElementById('doDropShape').addEventListener('click', doDropShapeClick);
document.getElementById('doDropShapeAll').addEventListener('click', doDropShapeAllClick);
document.getElementById('doAddNodePath').addEventListener('click', doAddNodePathClick);
document.getElementById('doMagneticNode').addEventListener('click', handleMagneticNodeClick);
document.getElementById('doChangeNodePath').addEventListener('click', doChangeNodePathClick);
document.getElementById('doDeleteNodePath').addEventListener('click', doDeleteNodePathClick);
document.getElementById('uploadImageButton').addEventListener('change', handleImageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update color.fill on change
document.getElementById('opacityInput').addEventListener('input', handleOpacityChange); // Update color.fill on change
document.getElementById('opacityInput').value = color.opacity;
document.getElementById('blendModes').addEventListener('change', handleBlendColor);
inactivateModes();
