import {imageLayer, stage, } from '@/init/layers';
import {is} from '@/modes';
import {selection, STROKE_WIDTH, PATH_OPACITY, CIRCLE_RADIUS_OFF, CIRCLE_RADIUS_ON,} from '@/vars';
import {getVerticesFromPathData, generatePathDataFromVertices, } from '@/path/funcs';
import {emit} from '@/lib/emit';

function numberTransformed(n, from) {
  const tr = stage.getAbsoluteTransform(from).invert();
  let p0 = {x: 0, y: 0};
  let p9 = {x: n, y: 0};
  p0 = tr.point(p0);
  p9 = tr.point(p9);

  const ntr = (p9.x - p0.x);
  return ntr;
}

function createHandleCircle(currentPath, vertex, index, fill) {
  const circle = new Konva.Circle({
    fill,
    visible: false,
    name: currentPath.id(),
    index,
    strokeScaleEnabled: false,
  });
  circle.radius(numberTransformed(CIRCLE_RADIUS_OFF, circle));
  // vertex has currentPath as space so transform it into imageLayer space 
  const p = currentPath.getAbsoluteTransform(imageLayer).point(vertex);
  // position using imageLayer - parent of circle -  space as reference
  circle.position(p);
  circle.on('dragstart', (evt) => {
    evt.cancelBubble = true;
    currentPath?.opacity(PATH_OPACITY);
  });
  circle.on('dragend', (evt) => {
    evt.cancelBubble = true;
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
    const n = numberTransformed(CIRCLE_RADIUS_ON, circle);
    circle.radius(n);
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
    c.strokeWidth(STROKE_WIDTH);
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
    evt.target.radius(numberTransformed(CIRCLE_RADIUS_OFF, circle));
  });

  circle.on('click', (evt) => {
    if (! is.deleteNodePath) {
      return;
    }

    evt.cancelBubble = true;
    
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
    if (! is.changeNodePath) {
      return;
    }
  
    evt.cancelBubble = true;

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

    is.changeNodePath = false;
    
    emit.send('changeNodePath');
  });

  imageLayer.add(circle);
  return circle;
}

function createHandleCircles(show=false) {
  selection.forEach(currentPath => {
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
  });
}

function destroyHandleCircles() {
  applyFnCircles(circle => circle.destroy());
}

function syncRadiusCircles(n = CIRCLE_RADIUS_OFF) {
  applyFnCircles(circle => circle.radius(numberTransformed(n, circle)));
}

function applyFnCircles(fn) {
  selection.forEach(currentPath => {
    const circles = imageLayer.find('.'+currentPath.id());
    circles.forEach((circle) => fn(circle));
  });
}

export {createHandleCircles, destroyHandleCircles, syncRadiusCircles};
