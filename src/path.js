import {stage, imageLayer, imageTransformer} from '@/init/layers';
import {is} from '@/modes';
import {lastPos, setLastPos} from '@/last-position';
import {animation01} from '@/animation';
import {previewLine} from '@/previewline';
import {color, node,} from '@/vars';

const STROKE_WIDTH = 1;
const PATH_OPACITY = 0.2;

let currentPathId = null; // Variable to hold the current path object
function setCurrentPathId(v) {
  currentPathId = v;
}

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
  if (lastPos && lastPos.x === pos.x && lastPos.y === pos.y) {
    return;
  }
  setLastPos(pos);

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

      if (is.addNodePath && this.selected) {
        let clickPoint = currentPath.getRelativePointerPosition();
        clickPoint.x = Math.round(clickPoint.x);
        clickPoint.y = Math.round(clickPoint.y);
        const [vertices, types] = getVerticesFromPathData(this.data());
        const [newPoint, index] = closestProjectedPoint(vertices, clickPoint);
        vertices.splice(index, 0, newPoint);
        let type = 'L';
        if (node.isMagnetic) {
          type = 'Q';
        }
        types.set(newPoint, type);
        const pathData = generatePathDataFromVertices(vertices, types);
        this.data(pathData);
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
      setLastPos(null); // Reset last position for drawing

      // Update button states
      document.getElementById('doDelete').disabled = false; // Enable the delete button
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
  let pathData = currentPath.data();
  if (pathData === '') {
      // M'ove command
      pathData += `M${pos.x},${pos.y}`;
  } else {
      // Add line to ('L') for subsequent clicks
      pathData += ` L${pos.x},${pos.y}`;
  }

  //// Update the path data
  currentPath.data(pathData);
  imageLayer.batchDraw();
  kevt.evt.stopImmediatePropagation();
}

function handleStageDblClick() {
  if (!currentPathId) return;

  previewLine?.remove();
  const currentPath = imageLayer.findOne(`#${currentPathId}`);
  if (currentPath.data().endsWith('Z') === true) {
    return;
  }

  // Close the path by adding 'Z' to the SVG path data
  let pathData = currentPath.data();
  pathData += ' Z';
  // Update the path data and set the closed flag
  currentPath.data(pathData);

  currentPath.fill(color.fill);
  currentPath.globalCompositeOperation(color.blend);
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
  document.getElementById('doDelete').disabled = false; // Enable delete button

  imageLayer.batchDraw();
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
    currentPath.data(newPathData);

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
    let pathData = generatePathDataFromVertices(vertices, types);
    currentPath.data(pathData);
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
    const pathData = generatePathDataFromVertices(vertices, types);
    currentPath.data(pathData);
    destroyHandleCircles();
    createHandleCircles(true);
    imageLayer.batchDraw();
  });

  imageLayer.add(circle);
  return circle;
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

// Function to reset drawing state
function resetPathState() {
  setCurrentPathId(null);
  setLastPos(null);
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

function distance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
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



export {STROKE_WIDTH, PATH_OPACITY};
export {currentPathId, setCurrentPathId, doDrawPathing, handleStageDblClick, getVerticesFromPathData, destroyHandleCircles, resetPathState};
