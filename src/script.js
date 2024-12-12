import {stage, imageLayer, bucketLayer, justContourLayer} from '@/init/layers';
import {imageTransformer} from '@/init/layers';
import '@/init/create-dofuncs';
import {is, mode} from '@/modes';
import {previewLine} from '@/previewline'; 
import {doSelectStart, doSelectEnd, doSelectFinal, doSelecting} from '@/selecting';
import {animation01} from '@/animation';
import {doDrawPathing, handleStageDblClick, resetPathState,} from '@/path';
import {destroyHandleCircles, } from '@/path/handle-circles';
import {lastPos, setLastPos} from '@/last-position';
import {color, node, selection} from '@/vars';
import {floodFillWorker} from '@/floodfill';
import {fillBucket, getImageDataComposedWithBucket, collapseBucketLayer, getAsRawImage} from  '@/bucket.js';
import {isFillWay, gco} from '@/fillWays';
import {imageUpload} from '@/handler/upload';

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
  if (selection.size === 0) {
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
  if (selection.size === 0) return;

  node.isMagnetic = ! node.isMagnetic;

  document.getElementById('doMagneticNode').checked = node.isMagnetic;
}

// Function to handle the "Fill Path" button click
function doFillClick() {
  if (selection.size === 0) return;
  const [currentPath] = selection;

  currentPath.fill(color.fill);
  currentPath.globalCompositeOperation(color.blend);
  currentPath.strokeWidth(0);

  imageLayer.batchDraw();

  document.getElementById('doFill').classList.remove('inactive');
}

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

  if (is.drawPath) {
    destroyHandleCircles();
    imageTransformer.nodes([]);
    return;
  }

  if (e?.target === stage) {
    selection.forEach(v => {
      v.strokeWidth(0);
      v.draggable(false);
    });
    destroyHandleCircles();
    selection.clear();
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
function collapseStroke() {
  if (bucketLayer.children.length === 0) return;
  const bucketImage = getAsRawImage(bucketLayer);
  bucketLayer.destroyChildren();
  bucketImage.globalCompositeOperation(gco());
  imageLayer.add(bucketImage);
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
  if (selection.size) {
    destroyHandleCircles();
    const [currentPath] = selection;
    selection.delete(currentPath);
    currentPath?.destroy(); // Remove the current path
    imageTransformer.nodes([]);
    resetPathState(); // Reset drawing state

    // Disable buttons since there's no current path
    document.getElementById('doFill').disabled = true;
    document.getElementById('fillColorPicker').disabled = true;
    document.getElementById('doDelete').disabled = true;

    // Clear the temporary line
    imageLayer.batchDraw();
  }
}

function handleClearAllClick() {
  const all = [imageLayer, justContourLayer, bucketLayer];
  all.forEach(l => {
    l.removeChildren();
    l.clear();
  });

  const [currentImage] = selection;
  selection.delete(currentImage);
  currentImage?.destroy();
  imageTransformer.nodes([]);
}

function doDropShapeClick() {
  if (selection.size === 0) {
    return;
  }

  const [currentPath] = selection;
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

  selection.forEach(v => {
    v.strokeWidth(0);
    v.draggable(false);
  });
  destroyHandleCircles();
  selection.clear();
  imageTransformer.nodes([]);

  // Disable the fill button, color picker, and delete button since we are starting a new path
  document.getElementById('doFill').disabled = true;
  document.getElementById('fillColorPicker').disabled = true;
  document.getElementById('doDelete').disabled = true;
}

function doAddNodePathClick() {
  if (selection.size === 0) {
    is.addNodePath = false;
    document.getElementById('doAddNodePath').classList.replace('active', 'inactive');
    return;
  }
  document.getElementById('doAddNodePath').classList[is.addNodePath ? 'remove' : 'add']('inactive');
}

function doDeleteNodePathClick() {
  if (selection.size === 0) {
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

// Mousedown event starts drawing with pencil
stage.on('mousedown', (evt) => {
  if (is.deleteNodePath || is.changeNodePath) {
    return;
  }

  if (!is.drawPath && selection.size) {
    const [p] = selection;
    if (false === (p instanceof Konva.Path)) return;
    // Prev path is currently drawing
    if (false === is.addNodePath && p.data().endsWith('Z') === true && selection.has(p) === true) {
      // Reset prev path
      p.strokeWidth(0);
      p.draggable(false);
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

      if (isFillWay.clean && pencil) {
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

  if (isFillWay.clean && pencil) {
    pencil.fill('#FFFFFF');
  }
  if (!pencilPrevPos) {
    pencilPrevPos = pos;
  }

  bucketLayer.batchDraw();
});

function handleDrawProtect() {
    isFillWay.protect = !isFillWay.protect;
    document.getElementById('drawProtectCheckbox').checked = isFillWay.protect;
    document.getElementById('drawProtectLabel').textContent = isFillWay.protect ? 'active' : 'inactive';
}

function handleFillClean() {
    isFillWay.clean = !isFillWay.clean;
    if (!isFillWay.clean && pencil) {
        pencil.fill(color.fill);
    }
    document.getElementById('fillCleanCheckbox').checked = isFillWay.clean;
    document.getElementById('fillCleanCheckboxLabel').textContent = isFillWay.clean ? 'active' : 'inactive';
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
  if (selection.size === 0) return;

  const z = currentPath.getZIndex();
  currentPath.setZIndex(z+1);
}

function handleDown() {
  if (selection.size === 0) return;

  const [currentPath] = selection;
  if (!selection.has(currentPath)) {
    return;
  }

  const z = currentPath.getZIndex();
  currentPath.setZIndex(z-1);
}

//FIXME
function inactivateModes(except='') {
  selection.clear();
  imageTransformer.nodes([]);
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
document.getElementById('drawProtectLabel').textContent = isFillWay.protect ? 'active' : 'inactive';

document.getElementById('fillCleanCheckbox').addEventListener('change', handleFillClean);
document.getElementById('fillCleanCheckboxLabel').textContent = isFillWay.clean ? 'active' : 'inactive';

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

document.getElementById('doDrawPath').addEventListener('click',handleNewPathClick);
document.getElementById('doDelete').addEventListener('click', handleDeleteClick);
document.getElementById('doDeleteAll').addEventListener('click', handleClearAllClick);
document.getElementById('doDropShape').addEventListener('click', doDropShapeClick);
document.getElementById('doDropShapeAll').addEventListener('click', doDropShapeAllClick);
document.getElementById('doAddNodePath').addEventListener('click', doAddNodePathClick);
document.getElementById('doMagneticNode').addEventListener('click', handleMagneticNodeClick);
document.getElementById('doChangeNodePath').addEventListener('click', doChangeNodePathClick);
document.getElementById('doDeleteNodePath').addEventListener('click', doDeleteNodePathClick);
document.getElementById('uploadImageButton').addEventListener('change', imageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update color.fill on change
document.getElementById('opacityInput').addEventListener('input', handleOpacityChange); // Update color.fill on change
document.getElementById('opacityInput').value = color.opacity;
document.getElementById('blendModes').addEventListener('change', handleBlendColor);
inactivateModes();
