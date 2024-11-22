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
var imageTransformer = new Konva.Transformer();
imageLayer.add(imageTransformer);
stage.add(imageLayer);
var bucketLayer = new Konva.Layer({
    id: 'bucket',
});
stage.add(bucketLayer);
var justContourLayer = new Konva.Layer({
    id: 'justContour',
});
stage.add(justContourLayer);

const selection = new Set();
const modes = {
  drawPath: 1 << 0,
  addNodePath: 1 << 1,
  changeNodePath: 1 << 2,
  deleteNodePath: 1 << 3,
  drawPencil: 1 << 4,
  fill: 1 << 5,
  select: 1 << 6,
  bucket: 1 << 7,
  magikWand : 1 << 8,
  drag: 1 << 9,
};
const ALL_IS = ((1 << Object.keys(modes).length) -1); // 1111...
// mode get/set a value - one of is
const mode = (m) => {
  if (m === undefined) return mode.value;
  const mIsValid = (m & ALL_IS) === m && (m & (m - 1)) === 0;
  if (! mIsValid) throw new Error(`${m} is not a valid mode`);
  mode.value = m;
};
mode.value = 0; // no modes 0000...
const is = {};
Object.keys(modes).forEach(k => {
  Object.defineProperty(is, k, {
    get: () => mode.value === modes[k],
    set: v => v ? mode(modes[k]) : mode.value = 0,
    enumerable: true,
    configurable: true,
  });
});

var currentImage; // Variable to hold the currently added image
// Variable to store the last clicked position
var lastPos = null;
// Global variable to store the fill color with a default value
var fillColor = '#000000'; // Default fill color (black)
// It controlls sensitivity for flooding image areas with fillColor
var fillColorSensitivity = 25;
var opacityColor = 100;
var blendColorDefault = 'source-over';
var blendColor = blendColorDefault;
// Size of pencil
var pencilSize = 30;

//function doSelect() {
//  is.select = !is.select;
//  document.getElementById('doSelect').classList.toggle('inactive');
//}
// Create functions like the one above for any do...modes's key
// and bind them to their coresponding DOM buttons
for (let k in modes) {
  const name = 'do' + k.charAt(0).toUpperCase() + k.slice(1);
  const fn = () => {
    is[k] = !is[k];
    // Add inactive class to all do...modes's key DOM elements
    document.querySelectorAll('[id^=do]')?.forEach(x => {
      let name = x.id.slice(2);
      name = name.charAt(0).toLowerCase() + name.slice(1);
      if (Object.keys(modes).includes(name) === false) return;;
      x.classList.add('inactive');
    })
    // toggle inactive class to pressed button
    document.getElementById(name)?.classList[is[k] ? 'remove' : 'add']('inactive');
  }
  Object.defineProperty(fn, 'name', {value: name});
  document.getElementById(name)?.addEventListener('click', fn);
  this[name] = fn;
}

const selectPoints = [{x: 0, y: 0}, {x: 0, y: 0}];
Object.defineProperty(selectPoints, 'x', {
  get: () => Math.min(selectPoints[0].x, selectPoints[1].x),
});
Object.defineProperty(selectPoints, 'y', {
  get: () => Math.min(selectPoints[0].y, selectPoints[1].y),
});
Object.defineProperty(selectPoints, 'width', {
  get: () => Math.abs(selectPoints[1].x - selectPoints[0].x),
});
Object.defineProperty(selectPoints, 'height', {
  get: () => Math.abs(selectPoints[1].y - selectPoints[0].y),
});
function doSelectStart(e) {
  if (! is.select) return;
  e.cancelBubble = true;
  e.evt.stopImmediatePropagation();

  selectPoints[0] = stage.getPointerPosition();
  selectPoints[1] = {...selectPoints[0]};

  const r = new Konva.Rect({
    fill: 'rgba(255,255,255,0.05)',
    stroke: 'white',
    strokeWidth: STROKE_WIDTH,
    dash: [8, 4],
    visible: true,
    listening: false,
    id: 'selectingRect',
  });
  r.width(0);
  r.height(0);
  animation01(() => !is.select, applyInvert => {
        if (applyInvert) {
          r.dash([4, 4]);
        } else {
          r.dash([8, 4]);
        }
        r.dashOffset(r.dashOffset() + 4);
  });
  imageLayer.add(r);
}
function doSelectEnd(e) {
  if (! is.select) return;
  e.cancelBubble = true;

  imageLayer.findOne('#selectingRect')?.destroy();
  selectPoints[0] = {x: 0, y: 0};
  selectPoints[1] = {x: 0, y: 0};
}
function doSelecting(e) {
  if (!is.select) return;
  e.cancelBubble = true;
  const r = imageLayer.findOne('#selectingRect');
  if (!r) return;

  selectPoints[1] = stage.getPointerPosition();
  r.setAttrs({
    x: selectPoints.x,
    y: selectPoints.y,
    width: selectPoints.width,
    height: selectPoints.height,
  }); 
}
function doSelectFinal(e) {
  if (! is.select) return;
  e.cancelBubble = true;
}

function handleBucketMode(kevt) {
  if (!is.bucket) {
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

const STROKE_WIDTH = 1;
const PATH_OPACITY = 0.2;

// Function to handle mouse click to add points to the path
function doDrawPathing(kevt) {
// TODO it is useless?
  if (currentPathId) {
    const currentPath = imageLayer.findOne(`#${currentPathId}`);
    // Closed path has no need to add new point
    if (currentPath.selected && currentPath.attrs.data.endsWith('Z')) {
      destroyHandleCircles();
      currentPath.strokeWidth(0);
      currentPath.draggable(false);
      currentPath.selected = false;
      currentPathId = null;
      imageLayer.batchDraw();
      return;
    }
  }

  if (!is.drawPath) {
    return;
  }

  var pos = stage.getRelativePointerPosition();
  // TODO it interferes with image clicking on same point will do nothing?
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
    imageLayer.add(currentPath);

    currentPath.on('click', function(evt) {
      if (is.select) return;
      if (is.drag) return;
      if (is.drawPath) return;
      evt.cancelBubble = true;
      // Click on unclosed curve does none
      if (this.data().endsWith('Z') === false) {
        return;
      }
      // Another path is currently drawing but we clicked on already closed path
      if (currentPathId !== null && this.getId() !== currentPathId) {
        const previousPath = imageLayer.findOne(`#${currentPathId}`);
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
        const previousPath = imageLayer.findOne(`#${currentPathId}`);
        previousPath.strokeWidth(0);
        previousPath.draggable(false);
        previousPath.selected = false;
      }
      currentPathId = this.getId(); // Set this path as the current path
      pathData = this.getAttr('data');
      currentImage = null;

      if (is.addNodePath && this.selected) {
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
        imageLayer.batchDraw();
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

      imageLayer.batchDraw();
      lastPos = null; // Reset last position for drawing

      // Update button states
      document.getElementById('deleteButton').disabled = false; // Enable the delete button
      document.getElementById('doFill').disabled = false; // Enable the fill button
      document.getElementById('fillColorPicker').disabled = false; // Enable the fill color picker
    });
    currentPath.on('mousedown', function(evt) {
      if (is.drawPath) return;
      if (is.select) return;
      if (is.drag) return;
      evt.cancelBubble = true;
      if (is.drag && !this.selected) {
        evt.cancelBubble = false;
      }
      if (ghostNode && this.selected) {
        ghostNode.setAttrs({fill: 'red', opacity: 1});
      }
      if (currentPath.selected) {
        document.body.style.cursor = 'grab';
      }
    });
    currentPath.on('mouseup', function(e) {
      if (is.drawPath) return;
      if (is.select) return;
      if (is.drag) return;
      imageTransformer.nodes([]);
      const inx = imageTransformer.nodes().indexOf(e.target);
      if (inx === -1) { // not found exclusively add it
        imageTransformer.nodes([]);
        !is.drawPath && imageTransformer.nodes([e.target]);
      } else { // found remove it
        const nodes = imageTransformer.nodes().slice();
        nodes.splice(inx, 1);
        imageTransformer.nodes(nodes);
      }
      e.cancelBubble = true;
      if (is.drag && !this.selected) {
        e.cancelBubble = false;
      }
      if (is.addNodePath && ghostNode) {
        ghostNode.setAttrs({fill: 'white', opacity: 0.4});
      }
      document.body.style.cursor = 'default';
    });
    currentPath.on('dragstart', function(evt) {
      evt.cancelBubble = true;
      if (ghostNode && this.selected && is.addNodePath) {
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
      if (is.drag && !this.selected) {
        evt.cancelBubble = false;
      }
    });

    let ghostNode = null;
    currentPath.on('mousemove', () => {
      if (is.addNodePath && currentPath.selected) {
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
          // ghostNode is inside imageLayer so get reference to imageLayer
          itr = currentPath.getAbsoluteTransform();
          newPoint = itr.point(newPoint);
          ghostNode.absolutePosition(newPoint);
          ghostNode.visible(true);
        }
      }
    });
    currentPath.on('mouseenter', () => {
      if (is.addNodePath) {
        ghostNode = new Konva.Circle({
          x: 0,
          y: 0,
          radius: 10,
          fill: 'white',
          opacity: 0.4,
          visible: true,
          id: 'ghost',
        });
        imageLayer.add(ghostNode);
      }
    });
    currentPath.on('mouseleave', () => {
      ghostNode?.destroy();
      ghostNode = null;
    });
  } else {
    currentPath = imageLayer.findOne(`#${currentPathId}`);
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
    imageLayer.batchDraw();
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
  imageLayer.batchDraw();
  kevt.evt.stopImmediatePropagation();
}

function createHandleCircle(currentPath, vertex, index, fill) {
  const circle = new Konva.Circle({
    radius: 5,
    fill,
    visible: false,
    name: currentPath.id(),
    index,
  });
  // vertex has currentPath as space so transform it into imageLayer space 
  const p = currentPath.getAbsoluteTransform(imageLayer).point(vertex);
  // position using imageLayer - parent of circle -  space as reference
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

    imageLayer.batchDraw();
  });
  circle.on('mouseenter', () => {
    circle.radius(15);
  });
  circle.on('mousedown', (evt) => {
    if (is.deleteNodePath || is.changeNodePath) {
      return;
    }
    evt.cancelBubble = true;
    const c = evt.target;
    c.startDrag();
    c.draggable(true);
    c.fill('');
    c.strokeWidth(1);
    c.stroke(fill);
    document.body.style.cursor = 'none';
  });
  circle.on('mouseup', (evt) => {
    evt.cancelBubble = true;
    const c = evt.target;
    c.stopDrag();
    c.draggable(false);
    c.fill(fill);
    c.strokeWidth(0);
    c.stroke('');
    currentPath?.opacity(1);
    document.body.style.cursor = 'default';
  });
  circle.on('mouseleave', (evt) => {
    evt.target.radius(5);
  });

  circle.on('click', (evt) => {
    evt.cancelBubble = true;
    if (! is.deleteNodePath) {
      return;
    }
    if (! currentPathId) {
      return;
    }
   
    const c = evt.target;
    const [vertices, types] = getVerticesFromPathData(currentPath.data());
    const n = vertices[c.attrs.index];
    if (types.has(n)) {
      types.delete(n);
    }
    vertices.splice(c.attrs.index, 1);
    pathData = generatePathDataFromVertices(vertices, types);
    currentPath.setAttr('data', pathData);
    destroyHandleCircles();
    createHandleCircles(true);
    imageLayer.batchDraw();
  });
  circle.on('click', (evt) => {
    evt.cancelBubble = true;
    if (! is.changeNodePath) {
      return;
    }
    if (! currentPathId) {
      return;
    }
   
    const c = evt.target;
    const [vertices, types] = getVerticesFromPathData(currentPath.data());
    const n = vertices[c.attrs.index];
    if (! types.has(n)) {
      return;
    }
    let cmd = types.get(n);
    cmd = cmd === 'Q' ? 'L' : 'Q';
    types.set(n, cmd);
    pathData = generatePathDataFromVertices(vertices, types);
    currentPath.setAttr('data', pathData);
    destroyHandleCircles();
    createHandleCircles(true);
    imageLayer.batchDraw();
  });

  imageLayer.add(circle);
  return circle;
}
// Function to handle double click to close the path
function handleStageDblClick() {
  if (pathData === '') return;
  if (!currentPathId) return;

  previewLine?.remove();
  const currentPath = imageLayer.findOne(`#${currentPathId}`);
  if (currentPath.data().endsWith('Z') === true) {
    return;
  }

  currentPathId = null;
  // Close the path by adding 'Z' to the SVG path data
  pathData += ' Z';
  // Update the path data and set the closed flag
  currentPath.setAttr('data', pathData);

  currentPath.fill(fillColor);
  currentPath.globalCompositeOperation(blendColor);
  currentPath.strokeWidth(0);

  let ghostNode;
  let initialGhostPos = {x: 0, y: 0};
  currentPath.on('dragstart', () => {
    ghostNode = imageLayer.findOne('#ghost');
    if (! ghostNode) {
      return;
    }
    initialGhostPos = ghostNode.getAbsolutePosition();
    const tr = currentPath.getAbsoluteTransform();
    // relative to currentPath
    initialGhostPos = tr.copy().invert().point(initialGhostPos);
  });
  // Update circle positions on path move
  currentPath.on('dragmove transform', () => {
    // calculate everything in viewport(canvas's stage as it is seen on screen) space
    const tr = currentPath.getAbsoluteTransform();

    if (currentPath.selected || is.deleteNodePath) {
      const [vertices, types] = getVerticesFromPathData(currentPath.data());
      const vertexCircles = imageLayer.find('.'+currentPath.id());
      vertexCircles.forEach((vertex) => {
        const {index} = vertex.attrs;
        if (!vertices[index]) {
          return;
        }
        const p = tr.point(vertices[index]);
        vertex.absolutePosition({
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

    imageLayer.batchDraw();
  });

  resetPathState();

  // Enable the "Fill Path" button and color picker after the path is closed
  document.getElementById('doFill').disabled = false;
  document.getElementById('fillColorPicker').disabled = false;
  document.getElementById('deleteButton').disabled = false; // Enable delete button

  imageLayer.batchDraw();
}

function createHandleCircles(show=false) {
  if (!currentPathId) return;
  const currentPath = imageLayer.findOne(`#${currentPathId}`);

  let [vertices, types] = getVerticesFromPathData(currentPath.data());
  let i = 0;
  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index];
    let already = vertices.slice(0, index).find(v => v.x === vertex.x && v.y === vertex.y);
    if (already) continue;
    i++; 
    let fill = 'red';
    const type = types.get(vertex);
    if (type === 'Q') {
      fill = 'blue';
    }
    const c = createHandleCircle(currentPath, vertex, index, fill);
    c.setAttr('visible', show);
  };
}

function destroyHandleCircles() {
  if (!currentPathId) return;
  const currentPath = imageLayer.findOne(`#${currentPathId}`);

  const circles = imageLayer.find('.'+currentPath.id());
  circles.forEach((circle) => circle.destroy());
}

function generatePathDataFromVertices(vertices, types) {
  let pathData = `M${vertices[0].x},${vertices[0].y}`;
  for (let i = 1; i < vertices.length; i++) {
    const vertex = vertices[i];
    if (!types.has(vertex)) continue; // TODO this is a serious flaw, the path is broken
    const next = vertices[i+1] ?? vertices[0];
    const command = types.get(vertex);
    if (vertex.x === next.x && vertex.y === next.y) {
      continue;
    }
    switch (command) {
      case 'L':
      pathData += ` L${vertex.x},${vertex.y}`;
      break;
      case 'Q':
      pathData += ` Q${vertex.x},${vertex.y},${next.x},${next.y}`;
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

let isMagneticNode = false;

function handleMagneticNodeClick() {
  if (!currentPathId) return;
  const currentPath = imageLayer.findOne(`#${currentPathId}`);

  isMagneticNode = ! isMagneticNode;

  document.getElementById('magneticNodeCheckbox').checked = isMagneticNode;
}

// Function to handle the "Fill Path" button click
function doFillClick() {
  if (!currentPathId) return;
  const currentPath = imageLayer.findOne(`#${currentPathId}`);

  currentPath.fill(fillColor);
  currentPath.globalCompositeOperation(blendColor);
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
      fillColor,
      tolerance: fillColorSensitivity,
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
    imageTransformer.nodes([]);
    imageTransformer.nodes([]);
  }
}

function handleSelectMode(kevt) {
  if (!is.magikWand) {
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
    fillColor,
    tolerance: fillColorSensitivity,
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
      document.getElementById('fillColorPicker').disabled = true;
      document.getElementById('deleteButton').disabled = true;

      // Clear the temporary line
      imageLayer.batchDraw();
    } else if (currentImage) {
      currentImage.destroy(); // Remove the current image
      currentImage = null; // Reset current image variable

      imageTransformer.nodes([]);

      // Disable the delete button since there's no current image
      document.getElementById('deleteButton').disabled = true;
      imageLayer.batchDraw(); // Redraw the imageLayer
    }
}

function handleClearAllClick() {
  const all = [imageLayer, justContourLayer, bucketLayer];
  all.forEach(l => {
    l.removeChildren();
    l.clear();
  });

  currentPathId = null;
  currentImage?.destroy();
  currentImage =null;
}

function dropShapeClick() {
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

function dropShapeAllClick() {
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

// Variable to store the current path data
var pathData = '';
var currentPathId = null; // Variable to hold the current path object

// Function to reset drawing state
function resetPathState() {
  currentPathId = null;
  pathData = '';
  lastPos = null;
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
  document.getElementById('fillColorPicker').disabled = true;
  document.getElementById('deleteButton').disabled = true;
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
        currentPathId = null;

        const pos = stage.getRelativePointerPosition();
        lastClickPos = pos;
        
        document.getElementById('deleteButton').disabled = false; // Enable delete button
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

      document.getElementById('deleteButton').disabled = false; // Enable delete button after image is added
    };
    img.src = event.target.result; // Set image source to the file's data URL
  };

  reader.readAsDataURL(file); // Read the file as a data URL
}

// Function to handle color picker change
function handleColorPickerChange(e) {
  fillColor = e.target.value; // Update global fillColor
  const alpha = Math.round(255*opacityColor/100).toString(16).padStart(2, '0')
  fillColor = fillColor.slice(0, 7) + alpha; 
  if (pencil) {
    pencil.fill(fillColor);
  }
}

function handleOpacityChange(e) {
  opacityColor = e.target.value;
  const alpha = Math.round(255*opacityColor/100).toString(16).padStart(2, '0')
  fillColor = fillColor.slice(0, 7) + alpha; 
  if (pencil) {
    pencil.fill(fillColor);
  }
}

function handleBlendColor(e) {
  blendColor = e.target.value;
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
let mousemove = false;

function gco() {
    const v = isFillClean ? 'destination-out' : (isDrawProtect ? 'destination-over' : blendColor);
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
        pencil.fill(fillColor);
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
  currentPathId = null;
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
    'deleteButton',
    'dropShape',
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
  lastPos = pos;
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
stage.on('mouseup mouseleave', (e) => {
  if (!is.drawPencil) return;
  e.cancelBubble = true;

  const pencilGhost = bucketLayer.findOne('#pencilGhost');
  if (pencilGhost) {
    pencilGhost.destroy();
  }
  collapseStroke();
});
// preview line
const previewLine = new Konva.Line({
  id: 'previewLine',
  points: [],
  stroke: 'white',
  strokeWidth: 1,
  lineCap: 'round',
  dash: [10, 5],
});
stage.on('mousedown', e => {
  if (!is.drawPath) return;
  e.cancelBubble = true;

  imageLayer.add(previewLine);
  previewLine.zIndex(imageLayer.children.length-1);
});
stage.on('mouseup click', e => {
  if (!is.drawPath) return;
  e.cancelBubble = true;

  previewLine.visible(false);
});
stage.on('mousemove', e => {
  if (!currentPathId || !lastPos) return; // Don't preview if no path or no previous point
  if (!is.drawPath) return;
  e.cancelBubble = true;

  var pos = imageLayer.getRelativePointerPosition();

  previewLine.visible(true);
  // Update the previewLine to preview the line from the last position to the current mouse position
  previewLine?.points([lastPos.x, lastPos.y, pos.x, pos.y]);
  imageLayer.batchDraw();
});

stage.on('click', removeSelection);
stage.on('click', handleSelectMode);
stage.on('click', handleBucketMode);
stage.on('click', doDrawPathing);
stage.on('dblclick', handleStageDblClick);

document.getElementById('doFill').addEventListener('click', doFillClick);

document.getElementById('fillSelectionImageButton').addEventListener('click', fillSelectionImageClick);
document.getElementById('fillImageSensitivityButton').addEventListener('input', handleFillImageSensitivityClick);
document.getElementById('fillImageSensitivityLabel').textContent = fillColorSensitivity; // Update global fillColorSensitivity

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

document.getElementById('deleteButton').addEventListener('click', handleDeleteClick);
document.getElementById('clearAllButton').addEventListener('click', handleClearAllClick);
document.getElementById('dropShape').addEventListener('click', dropShapeClick);
document.getElementById('dropShapeAll').addEventListener('click', dropShapeAllClick);
document.getElementById('doAddNodePath').addEventListener('click', doAddNodePathClick);
document.getElementById('magneticNodeCheckbox').addEventListener('change', handleMagneticNodeClick);
document.getElementById('doChangeNodePath').addEventListener('click', doChangeNodePathClick);
document.getElementById('doDeleteNodePath').addEventListener('click', doDeleteNodePathClick);
document.getElementById('uploadImageButton').addEventListener('change', handleImageUpload);
document.getElementById('fillColorPicker').addEventListener('input', handleColorPickerChange); // Update fillColor on change
document.getElementById('opacityInput').addEventListener('input', handleOpacityChange); // Update fillColor on change
document.getElementById('opacityInput').value = opacityColor;
document.getElementById('blendModes').addEventListener('change', handleBlendColor);
inactivateModes();
