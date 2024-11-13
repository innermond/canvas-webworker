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
var justContourLayer = new Konva.Layer({
    id: 'justContour',
});
stage.add(justContourLayer);
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

function handleBucketMode(kevt) {
  if (!isBucketMode) {
    return;
  }

  if (kevt.target === stage) return;

  lastPos = stage.getRelativePointerPosition();
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

const STROKE_WIDTH = 2;
const PATH_OPACITY = 0.4;

// Function to handle mouse click to add points to the path
function handlePathMode(kevt) {
// TODO it is useless?
  if (currentPathId) {
    const currentPath = pathLayer.findOne(`#${currentPathId}`);
    // Closed path has no need to add new point
    if (currentPath.selected && currentPath.attrs.data.endsWith('Z')) {
      destroyHandleCircles();
      currentPath.strokeWidth(0);
      currentPath.draggable(false);
      currentPath.selected = false;
      currentPathId = null;
      pathLayer.batchDraw();
      return;
    }
  }

  if (!isDrawPath) {
    return;
  }

  var pos = stage.getRelativePointerPosition();
  if (lastPos && lastPos.x === pos.x && lastPos.y === pos.y && pathData !== '') {
    return;
  }
  lastPos = pos;

  // double click
  if (kevt.evt.detail > 1) {
    return;
  } 

  let currentPath;
  if (!currentPathId) {
    currentPathId = `Path${Math.random().toString(36).slice(2)}`;
    currentPath = new Konva.Path({
      data: '',
      stroke: 'white',
      strokeWidth: STROKE_WIDTH,
      dash: [8, 4],
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
          destroyHandleCircles();
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
      pathData = this.getAttr('data');

      if (isAddNode && this.selected) {
        let clickPoint = currentPath.getRelativePointerPosition();
        clickPoint.x = Math.round(clickPoint.x);
        clickPoint.y = Math.round(clickPoint.y);
        const [vertices, types] = getVerticesFromPathData(pathData);
        const [newPoint, index] = closestProjectedPoint(vertices, clickPoint);
        vertices.splice(index, 0, newPoint);
        let type = 'L';
        if (isMagneticNode) {
          type = 'Q';
        }
        types.set(newPoint, type);
        pathData = generatePathDataFromVertices(vertices, types);
        this.setAttr('data', pathData);
        destroyHandleCircles();
        createHandleCircles(true);
        pathLayer.batchDraw();
        return;
      }
      this.selected = !this?.selected;
      if (this?.selected) {
        this.strokeWidth(STROKE_WIDTH);
        this.draggable(true);
        destroyHandleCircles();
        createHandleCircles(true);
      } else {
        this.strokeWidth(0);
        this.draggable(false);
        destroyHandleCircles();
      }

      animation01(() => !this.selected, (applyInvert) => {
        if (applyInvert) {
          this.dash([4, 4]);
        } else {
          this.dash([8, 4]);
        }
        this.dashOffset(this.dashOffset() + 4);
      });

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
      if (ghostNode && this.selected) {
        ghostNode.setAttrs({fill: 'red', opacity: 1});
      }
      if (currentPath.selected) {
        document.body.style.cursor = 'grab';
      }
    });
    currentPath.on('mouseup', function(evt) {
      evt.cancelBubble = true;
      if (isDragging && !this.selected) {
        evt.cancelBubble = false;
      }
      if (isAddNode && ghostNode) {
        ghostNode.setAttrs({fill: 'white', opacity: 0.4});
      }
      document.body.style.cursor = 'default';
    });
    currentPath.on('dragstart', function(evt) {
      evt.cancelBubble = true;
      if (ghostNode && this.selected && isAddNode) {
        ghostNode.setAttrs({fill: 'white', opacity: 0.4});
      }
      this.opacity(PATH_OPACITY);
    });
    currentPath.on('dragend', function(evt) {
      evt.cancelBubble = true;
      this.opacity(1);
     });
    currentPath.on('dragmove', function(evt) {
      evt.cancelBubble = true;
      if (isDragging && !this.selected) {
        evt.cancelBubble = false;
      }
    });

    let ghostNode = null;
    currentPath.on('mousemove', () => {
      if (isAddNode && currentPath.selected) {
        // canvas point (it is relative to viewport)
        let movingPoint = stage.getPointerPosition();
        // to currentPath related to viewport
        let itr = currentPath.getAbsoluteTransform().copy().invert();
        movingPoint = itr.point(movingPoint);
        movingPoint.x = Math.round(movingPoint.x);
        movingPoint.y = Math.round(movingPoint.y);
        const [vertices, types] = getVerticesFromPathData(currentPath.data());
        let [newPoint,] = closestProjectedPoint(vertices, movingPoint);
        if (ghostNode) {
          // newPoint is in currentPath coordinates space
          // ghostNode is inside pathLayer so get reference to pathLayer
          itr = currentPath.getAbsoluteTransform();
          newPoint = itr.point(newPoint);
          ghostNode.absolutePosition(newPoint);
          ghostNode.visible(true);
        }
      }
    });
    currentPath.on('mouseenter', () => {
      if (isAddNode) {
        ghostNode = new Konva.Circle({
          x: 0,
          y: 0,
          radius: 10,
          fill: 'white',
          opacity: 0.4,
          visible: true,
          id: 'ghost',
        });
        pathLayer.add(ghostNode);
      }
    });
    currentPath.on('mouseleave', () => {
      ghostNode?.destroy();
      ghostNode = null;
    });
  } else {
    currentPath = pathLayer.findOne(`#${currentPathId}`);
  }

  if (! currentPath) {
    return;
  }

  // Closed path has no need to add new point
  if (currentPath.selected && currentPath.attrs.data.endsWith('Z')) {
    destroyHandleCircles();
    currentPath.strokeWidth(0);
    currentPath.draggable(false);
    currentPath.selected = false;
    currentPathId = null;
    pathLayer.batchDraw();
    return;
  }

  const itr = currentPath.getAbsoluteTransform().copy().invert();
  // relative to stage to absolute canvas/stage
  pos = stage.getAbsoluteTransform().point(pos);
  // absolute to local currentPath
  pos = itr.point(pos);
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
  if (! isDrawPath) return;

  var pos = pathLayer.getRelativePointerPosition();

  // Update the previewLine to preview the line from the last position to the current mouse position
  previewLine.points([lastPos.x, lastPos.y, pos.x, pos.y]);
  pathLayer.batchDraw();
}

function createHandleCircle(currentPath, vertex, index, fill) {
  const circle = new Konva.Circle({
    radius: 5,
    fill,
    visible: false,
    name: currentPath.id(),
    index,
  });
  // vertex has currentPath as space so transform it into pathLayer space 
  const p = currentPath.getAbsoluteTransform(pathLayer).point(vertex);
  // position using pathLayer - parent of circle -  space as reference
  circle.position(p);
  circle.on('dragstart', (evt) => {
    evt.cancelBubble = true;
    currentPathId = currentPath.id(); 
    currentPath?.opacity(PATH_OPACITY);
  });
  circle.on('dragend', (evt) => {
    evt.cancelBubble = true;
    currentPathId = currentPath.id(); 
    currentPath?.opacity(1);
  });
  // Event to update path when circle is dragged
  circle.on('dragmove', (evt) => {
    evt.cancelBubble = true;

    if ( ! circle.draggable()) {
      return;
    }
    let point = circle.getAbsolutePosition();
    const itr = currentPath.getAbsoluteTransform().copy().invert();
    point = itr.point(point);
    // Update vertex position in vertices array
    const index = circle.attrs.index;
    const [vertices, types] = getVerticesFromPathData(currentPath.data());
    vertices[index].x = point.x;
    vertices[index].y = point.y;

    // Generate new path data and update path
    const newPathData = generatePathDataFromVertices(vertices, types);
    currentPath.setAttr('data', newPathData);

    pathLayer.batchDraw();
  });
  circle.on('mouseenter', () => {
    circle.radius(15);
  });
  circle.on('mousedown', (evt) => {
    if (isDeleteNode) {
      return;
    }
    evt.cancelBubble = true;
    circle.startDrag();
    circle.draggable(true);
    circle.fill('');
    circle.strokeWidth(1);
    circle.stroke(fill);
    document.body.style.cursor = 'none';
  });
  circle.on('mouseup', (evt) => {
    evt.cancelBubble = true;
    circle.stopDrag();
    circle.draggable(false);
    circle.fill(fill);
    circle.strokeWidth(0);
    circle.stroke('');
    currentPath?.opacity(1);
    document.body.style.cursor = 'default';
  });
  circle.on('mouseleave', () => {
    circle.radius(5);
  });

  circle.on('click', (evt) => {
    evt.cancelBubble = true;
    if (! isDeleteNode) {
      return;
    }
    if (! currentPathId) {
      return;
    }

    const [vertices, types] = getVerticesFromPathData(currentPath.data());
    const n = vertices[circle.attrs.index];
    if (types.has(n)) {
      types.delete(n);
    }
    vertices.splice(circle.attrs.index, 1);
    pathData = generatePathDataFromVertices(vertices, types);
    currentPath.setAttr('data', pathData);
    destroyHandleCircles();
    createHandleCircles(true);
    pathLayer.batchDraw();
  });

  pathLayer.add(circle);
  return circle;
}
// Function to handle double click to close the path
function handleStageDblClick() {
  if (pathData === '') return;
  if (!currentPathId) return;

  const currentPath = pathLayer.findOne(`#${currentPathId}`);
  if (currentPath.data().endsWith('Z') === true) {
    return;
  }

  // Close the path by adding 'Z' to the SVG path data
  pathData += ' Z';
  // Update the path data and set the closed flag
  currentPath.setAttr('data', pathData);

  currentPath.fill(fillColor);
  currentPath.strokeWidth(0);

  let ghostNode;
  let initialGhostPos = {x: 0, y: 0};
  currentPath.on('dragstart', () => {
    ghostNode = pathLayer.findOne('#ghost');
    if (! ghostNode) {
      return;
    }
    initialGhostPos = ghostNode.getAbsolutePosition();
    const tr = currentPath.getAbsoluteTransform();
    // relative to currentPath
    initialGhostPos = tr.copy().invert().point(initialGhostPos);
  });
  // Update circle positions on path move
  currentPath.on('dragmove', () => {
    // calculate everything in viewport(canvas's stage as it is seen on screen) space
    const tr = currentPath.getAbsoluteTransform();

    if (currentPath.selected || isDeleteNode) {
      const [vertices, types] = getVerticesFromPathData(currentPath.data());
      const vertexCircles = pathLayer.find('.'+currentPath.id());
      vertices.forEach((vertex, index) => {
        if (!vertexCircles[index]) {
          return;
        }
        const p = tr.point(vertex);
        vertexCircles[index].absolutePosition({
          x: p.x,
          y: p.y,
        });
      });
    }
    // TODO fix wrongly ghost's positioning!!!
    if (ghostNode) {
      const gtr = tr.point(initialGhostPos);
      gtr.x = Math.round(gtr.x);
      gtr.y = Math.round(gtr.y);
      ghostNode.absolutePosition(gtr);      
    }

    pathLayer.batchDraw();
  });

  resetPathState();

  // Enable the "Fill Path" button and color picker after the path is closed
  document.getElementById('fillButton').disabled = false;
  document.getElementById('fillColorPicker').disabled = false;
  document.getElementById('deleteButton').disabled = false; // Enable delete button

  pathLayer.batchDraw();
}

function createHandleCircles(show=false) {
  if (!currentPathId) return;
  const currentPath = pathLayer.findOne(`#${currentPathId}`);

  let [vertices, types] = getVerticesFromPathData(currentPath.data());
  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index];
    let already = vertices.slice(0, index).find(v => v.x === vertex.x && v.y === vertex.y);
    if (already) continue;

    let fill = 'red';
    const type = types.get(vertex);
    if (type === 'Q') {
      const before = types.get(vertices[index-1]);
      let beforeWasQ = before === 'Q';
      if (!beforeWasQ) {
        fill = 'blue';
      }
    }
    const c = createHandleCircle(currentPath, vertex, index, fill);
    c.setAttr('visible', show);
  };
}

function destroyHandleCircles() {
  if (!currentPathId) return;
  const currentPath = pathLayer.findOne(`#${currentPathId}`);

  const circles = pathLayer.find('.'+currentPath.id());
  circles.forEach((circle) => circle.destroy());
}

function generatePathDataFromVertices(vertices, types) {
  let pathData = `M${vertices[0].x},${vertices[0].y}`;
  for (let i = 1; i < vertices.length; i++) {
    const vertex = vertices[i];
    if (!types.has(vertex)) continue; // TODO this is a serious flaw, the path is broken
    const command = types.get(vertex);
    switch (command) {
      case 'L':
      pathData += ` L${vertex.x},${vertex.y}`;
      break;
      case 'Q':
      const next = vertices[i+1] ?? vertices[0];
      if (vertex.x === next.x && vertex.y === next.y) {
        continue;
      }
      pathData += ` Q${vertex.x},${vertex.y},${next.x},${next.y}`;
      i += 1; 
      break;
    }
  }
  pathData += ' Z';
  return pathData;
}

function getVerticesFromPathData(pathData) {
  const vertices = [];
  const types = new WeakMap();
  const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g); // Split by command characters

  let currentX = 0;
  let currentY = 0;

  for (let inx = 0; inx < commands.length; inx++) {
    const command = commands[inx];
    const type = command[0];
    const coords = command.slice(1).trim().split(/[\s,]+/).map(Number);

    switch (type) {
      case 'M': // Move to
      case 'L': // Line to
        for (let i = 0; i < coords.length; i += 2) {
          currentX = coords[i];
          currentY = coords[i + 1];
          let p = { x: currentX, y: currentY };
          p = getPointFrom(p, vertices);
          vertices.push(p);
          types.set(p, type);
        }
        break;
      case 'Q':
        const [kx, ky, zx, zy] = coords;
        let pk = { x: kx, y: ky };
        pk = getPointFrom(pk, vertices);
        let pz = { x: zx, y: zy };
        pz = getPointFrom(pz, vertices);
        vertices.push(pk, pz);
        types.set(pk, 'Q');
        //let typ = 'L';
        //if (commands[inx-1][0] === 'Q') {
        //  typ = 'Q';
        //}
        let typ = 'L';
        types.set(pz, typ);
      break;
    }
  };

  return [vertices, types];
}

function getPointFrom(p, vertices) {
  return vertices.find(v => {
    return v.x === p.x && v.y === p.y;
  }) ?? p;
}

let isMagneticNode = false;

function handleMagneticNodeClick() {
  if (!currentPathId) return;
  const currentPath = pathLayer.findOne(`#${currentPathId}`);

  isMagneticNode = ! isMagneticNode;

  document.getElementById('magneticNodeCheckbox').checked = isMagneticNode;
}

// Function to handle the "Fill Path" button click
function handleFillClick() {
  if (!currentPathId) return;
  const currentPath = pathLayer.findOne(`#${currentPathId}`);

  currentPath.fill(fillColor);
  currentPath.strokeWidth(0);

  pathLayer.batchDraw();
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
  document.getElementById('deleteButton').disabled = false;
};

function animation01(exitFn, animationFn, atMillisec=150) {
  let zero;
  requestAnimationFrame(start);
  function start(t) {
    zero = t;
    animate(t)
  }
  let applyInvert = true;
  async function animate(t) {
    if (exitFn()) {
      return;
    }

    const d = (t - zero) / atMillisec;
    if (d > 1) {
      animationFn(applyInvert);
      applyInvert = ! applyInvert;
      requestAnimationFrame(t => start(t));
    } else {
      requestAnimationFrame(t => animate(t));
    }
  };
}

// It control if flood filling is allowed
let isBucketMode = false;

// Function to handle filling the image with the global color using Web Worker
function handleFillImageClick() {
  isBucketMode = !isBucketMode;
  // When filling mode begins it requires you 
  // to choose a starting color (by position) from image
  document.getElementById('fillImageButton').classList[isBucketMode ? 'remove' : 'add']('inactive'); // Enable fill image button
  if (! isBucketMode) {
    return;
  }

  isDrawPencil = false;
  isDrawPath = false;
  isSelectImageMode = false;

  document.getElementById('newPathButton').classList.add('inactive');
  document.getElementById('drawPencil').classList.add('inactive');
  document.getElementById('selectImageButton').classList.add('inactive');
}

let isSelectImageMode = false;

function handleSelectImageClick() {
  isSelectImageMode = ! isSelectImageMode;
  document.getElementById('selectImageButton').classList.toggle('inactive');

  if (isSelectImageMode === false) {
    return;
  }

  isDrawPencil = false;
  isDrawPath = false;
  isBucketMode = false;

  document.getElementById('newPathButton').classList.add('inactive');
  document.getElementById('drawPencil').classList.add('inactive');
  document.getElementById('fillImageButton').classList.add('inactive');
}

async function fillSelectionImageClick() {
  if (isSelectImageMode === false) {
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
      fillColor,
      tolerance: fillColorSensitivity,
    };
    if (justContour) {
      msg.justContour = true;
    }
    floodFillWorker.postMessage(msg);
  }
}

function removeSelection() {
  document.getElementById('fillSelectionImageButton').classList.add('inactive');
  if (isAddNode) {
    isAddNode = false;
    document.getElementById('newPathNodeButton').classList.add('inactive');
  }
  if (isDeleteNode) {
    isDeleteNode = false;
    document.getElementById('deletePathNodeButton').classList.add('inactive');
  }

  const a = justContourLayer.children.length;
  if (a > 0) {
    justContourLayer.destroyChildren();
    justContourLayer.batchDraw();
  }
}

function handleSelectMode(kevt) {
  if (!isSelectImageMode) {
    return true;
  }
  if (kevt.target === stage) return;

  lastPos = stage.getRelativePointerPosition();
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
  const bucketOrSelectImage = isBucketMode || isSelectImageMode;
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
    fillColor,
    tolerance: fillColorSensitivity,
    justContour: isSelectImageMode,
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
      destroyHandleCircles();
      const currentPath = pathLayer.findOne(`#${currentPathId}`);
      currentPath.destroy(); // Remove the current path
      pathLayer.find(currentPathId).forEach(c => c.destroy());
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

function dropShapeClick() {
  if (! currentPathId) {
    return;
  }

  const currentPath = pathLayer.findOne(`#${currentPathId}`);
  if (! currentPath) {
    return;
  }

  currentPath.strokeWidth(0);
  bucketLayer.add(currentPath);
  collapseBucketLayer();
  resetPathState();
}

function dropShapeAllClick() {
  for (let i=0; i < pathLayer.children.length; i++) {
    const p = pathLayer.children[i];
    if (p.getId() === 'previewLine') {
      continue;
    }
    p.strokeWidth(0);
    bucketLayer.add(p);
    i--;
  };
  collapseBucketLayer();
  resetPathState();
  pathLayer.batchDraw();
  bucketLayer.batchDraw();
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
  stroke: 'white',
  strokeWidth: 1,
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
    strokeWidth: 1,
    lineCap: 'round',
    dash: [10, 5], // Dashed line
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

function handleNewPathClick() {
  resetPathState();

  isDrawPath = !isDrawPath;
  if (isDrawPath === false) {
    document.getElementById('newPathButton').classList.add('inactive');
    return;
  }
  isDrawPencil = false;
  isSelectImageMode = false;
  isBucketMode = false;

  document.getElementById('drawPencil').classList.add('inactive');
  document.getElementById('selectImageButton').classList.add('inactive');
  document.getElementById('fillImageButton').classList.add('inactive');
  document.getElementById('newPathButton').classList.remove('inactive');
  // Disable the fill button, color picker, and delete button since we are starting a new path
  document.getElementById('fillButton').disabled = true;
  document.getElementById('fillColorPicker').disabled = true;
  document.getElementById('deleteButton').disabled = true;
}

let isAddNode = false;
function handleNewPathNodeClick() {
  if (! currentPathId) {
    return;
  }

  isAddNode = ! isAddNode;

  if (isAddNode) {
    isDrawPath = false;
    document.getElementById('newPathButton').classList.add('inactive');
  }
  document.getElementById('newPathNodeButton').classList[isAddNode ? 'remove' : 'add']('inactive');
}

let isDeleteNode = false;
function handleDeletePathNodeClick() {
  if (! currentPathId) {
    return;
  }

  isDeleteNode = ! isDeleteNode;

  if (isDeleteNode) {
    isDrawPath = false;
    document.getElementById('newPathButton').classList.add('inactive');
  }
  document.getElementById('deletePathNodeButton').classList[isDeleteNode ? 'remove' : 'add']('inactive');
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
  if (isDragging === true) {
    const ii = stage.getAllIntersections(stage.getPointerPosition());
    for (let i of ii) {
      // going inside currentPath?
      if (i.attrs?.name === currentPathId) {
        return;
      }
    }
    stage.startDrag();
    return;
  }

  if (isDeleteNode) {
    return;
  }

  if (!isDrawPath && currentPathId) {
    const p = pathLayer.findOne(`#${currentPathId}`);
    // Prev path is currently drawing
    if (false === isAddNode && p.data().endsWith('Z') === true && p.selected === true) {
      // Reset prev path
      p.strokeWidth(0);
      p.draggable(false);
      p.selected = false;
      destroyHandleCircles();
    }
  }

  if (!isDrawPencil) {
    return;
  }

  // TODO: Must be first or not at all???
  const pos = stage.getRelativePointerPosition();
  lastPos = pos;

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
    fill: 'transparent', stroke: fillColor, strokeWidth: 1,
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
  document.body.style.cursor = 'default';
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
  removeSelection();

  isDrawPencil = !isDrawPencil;
  if (isDrawPencil === false ) {
    document.getElementById('drawPencil').classList.add('inactive');
    return;
  }

  isBucketMode = false;
  isDrawPath = false;
  isDragging = false;
  stage.stopDrag();
  isSelectImageMode = false;

  document.getElementById('isDraggingCheckbox').checked = isDragging;
  document.getElementById('isDraggingCheckboxLabel').textContent = 'inactive';

  document.getElementById('fillImageButton').classList.add('inactive');
  document.getElementById('newPathButton').classList.add('inactive');
  document.getElementById('selectImageButton').classList.add('inactive');

  document.getElementById('drawPencil').classList.remove('inactive');
}

function distance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function closestProjectedPoint(points, clickPoint) {
  let smallest = Infinity;
  let projected, index;
  const pp = [...points, points[0]]; // closed path
  for (let i = 1, p = {x: 0, y: 0}, curr = 0; i < pp.length; i++) {
    p = projectPointOntoSegment(pp[i-1], pp[i], clickPoint);
    curr = distance(clickPoint, p);
    if (curr < smallest) {
      smallest = curr;
      projected = p;
      index = i-1;
    }
  }
  return [projected, index + 1];
}

// Function to project a point onto a segment (p1, p2)
function projectPointOntoSegment(p1, p2, clickPoint) {
  // TODO human error here
  //const p1p2 = distance(p1, p2);
  //const p1c = distance(p1, clickPoint);
  //const p2c = distance(p2, clickPoint);
  //const cosp1 = (p1c*p1c + p1p2*p1p2 - p2c*p2c)/(2*p1c*p1p2);
  //const dist = cosp1*p1c;
  //const sx = (p2.x-p1.x)*(dist/p1p2);
  //const sy = Math.sqrt(dist*dist - sx*sx);
  //let x = p1.x + sx;
  //let y = p1.y + sy;
  //x = Math.round(x);
  //y = Math.round(y);

  //return {x, y};

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Calculate t, the parameter of the projection point along the line
  const t = ((clickPoint.x - p1.x) * dx + (clickPoint.y - p1.y) * dy) / (dx * dx + dy * dy);

  // Clamp t to [0, 1] to stay within the segment bounds
  const clampedT = Math.max(0, Math.min(1, t));

  // Calculate the projection point along the segment
  const projectedPoint = {
    x: p1.x + clampedT * dx,
    y: p1.y + clampedT * dy
  };
  projectedPoint.x = Math.round(projectedPoint.x);
  projectedPoint.y = Math.round(projectedPoint.y);
  //console.log({x, y}, projectedPoint)
  return projectedPoint;
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
  const currentPath = pathLayer.findOne(`#${currentPathId}`);
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
  const currentPath = pathLayer.findOne(`#${currentPathId}`);
  if (!currentPath.selected) {
    return;
  }

  const z = currentPath.getZIndex();
  currentPath.setZIndex(z-1);
}

// Attach event listeners
stage.on('click', removeSelection);
stage.on('click', handleSelectMode);
stage.on('click', handleBucketMode);
stage.on('click', handlePathMode);
stage.on('mousemove', previewCurrentLine);
stage.on('dblclick', handleStageDblClick);

document.getElementById('fillButton').addEventListener('click', handleFillClick);

document.getElementById('selectImageButton').addEventListener('click', handleSelectImageClick);
document.getElementById('fillSelectionImageButton').addEventListener('click', fillSelectionImageClick);
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

document.getElementById('upz').addEventListener('click', handleUp);
document.getElementById('downz').addEventListener('click', handleDown);

document.getElementById('zoomButton').addEventListener('input', handleZoom);
document.getElementById('zoomButton').setAttribute('step', zoomFactor);
document.getElementById('zoomButton').value = zoomScale;
document.getElementById('zoomButtonLabel').textContent = mapZoom(zoomScale);

document.getElementById('isDraggingCheckbox').addEventListener('change', handleDragging);
document.getElementById('isDraggingCheckboxLabel').textContent = isDragging ? 'active' : 'inactive';

document.getElementById('deleteButton').addEventListener('click', handleDeleteClick);
document.getElementById('clearAllButton').addEventListener('click', handleClearAllClick);
document.getElementById('dropShape').addEventListener('click', dropShapeClick);
document.getElementById('dropShapeAll').addEventListener('click', dropShapeAllClick);
document.getElementById('undoButton').addEventListener('click', handleUndoClick);
document.getElementById('redoButton').addEventListener('click', handleRedoClick);
document.getElementById('newPathButton').addEventListener('click', handleNewPathClick);
document.getElementById('newPathNodeButton').addEventListener('click', handleNewPathNodeClick);
document.getElementById('magneticNodeCheckbox').addEventListener('change', handleMagneticNodeClick);
document.getElementById('deletePathNodeButton').addEventListener('click', handleDeletePathNodeClick);
document.getElementById('uploadImageButton').addEventListener('change', handleImageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update fillColor on change
