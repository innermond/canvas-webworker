import {imageLayer, } from '@/init/layers';
import {is} from '@/modes';
import {currentPathId, setCurrentPathId, PATH_OPACITY} from '@/path';
import {getVerticesFromPathData, generatePathDataFromVertices, } from '@/path/funcs';

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
    setCurrentPathId(currentPath.id()); 
    currentPath?.opacity(PATH_OPACITY);
  });
  circle.on('dragend', (evt) => {
    evt.cancelBubble = true;
    setCurrentPathId(currentPath.id()); 
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


export {createHandleCircles, destroyHandleCircles, };
