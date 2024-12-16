import {stage, imageLayer, imageTransformer} from '@/init/layers';
import {is} from '@/modes';
import {STROKE_WIDTH} from '@/path';
import {animation01} from '@/animation';
import {selection} from '@/vars';
import {destroyHandleCircles, createHandleCircles, } from '@/path/handle-circles';

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
  if (selection.size) return;
  e.cancelBubble = true;
  e.evt.stopImmediatePropagation();

  selectPoints[0] = stage.getRelativePointerPosition();
  selectPoints[1] = {...selectPoints[0]};

  const r = new Konva.Rect({
    fill: 'rgba(255,255,255,0.05)',
    stroke: 'white',
    strokeWidth: STROKE_WIDTH,
    strokeScaleEnabled: false,
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
  if (selection.size) return;
  e.cancelBubble = true;
  
  addNodesToSelection();
  imageLayer.findOne('#selectingRect')?.destroy();
  selectPoints[0] = {x: 0, y: 0};
  selectPoints[1] = {x: 0, y: 0};

  imageTransformer.nodes(Array.from(selection.values()));
  destroyHandleCircles();
  createHandleCircles(true);
  selection.forEach(s => {
    s.draggable(true);
    s.strokeWidth(STROKE_WIDTH);
    s.strokeScaleEnabled(false);
    animation01(() => !selection.has(s), applyInvert => {
      if (applyInvert) {
        s.dash([4, 4]);
      } else {
        s.dash([8, 4]);
      }
      s.dashOffset(s.dashOffset() + 4);
    });
  });
}

function addNodesToSelection() {
  const sr = imageLayer.findOne('#selectingRect');
  if (!sr) return;

  const box = sr.getClientRect();
  imageLayer.children.forEach(s => {
    if (Object.is(s, sr)) return;
    if (!(s instanceof Konva.Path)) return;
    if (s.visible() === false) return;
    if (isContainingRect(box, getStagedClientRect(s)) === false) return;
    selection.add(s);
  });
}

function getStagedClientRect(s) {
  const xx = [], yy = [];
  const tr = s.getAbsoluteTransform(stage);
  let p = {x: 0, y: 0};
    
  s.data().split(/\s+/).forEach(s => {
    if (s === 'Z') return;
    s = s.split(',');
    p.x = parseInt(s[0].slice(1));
    p.y = parseInt(s[1]);
    p = tr.point(p);
    xx.push(p.x);
    yy.push(p.y);
  });
  const xmin = Math.min.apply(null, xx), xmax = Math.max.apply(null, xx);
  const ymin = Math.min.apply(null, yy), ymax = Math.max.apply(null, yy);

  return {x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin};
}

function isContainingRect(r1, r2) {
  if (r1.x > r2.x) return false; 
  if (r1.y > r2.y) return false; 
  if (r1.width < r2.width) return false; 
  if (r1.height < r2.height) return false; 
  return true;
}

function doSelecting(e) {
  if (!is.select) return;
  if (selection.size) return;
  e.cancelBubble = true;
  const r = imageLayer.findOne('#selectingRect');
  if (!r) return;

  selectPoints[1] = stage.getRelativePointerPosition();
  r.setAttrs({
    x: selectPoints.x,
    y: selectPoints.y,
    width: selectPoints.width,
    height: selectPoints.height,
  }); 
}

function doSelectFinal(e) {
  if (! is.select) return;
  if (selection.size) return;
  e.cancelBubble = true;
}

export {selection, doSelectStart, doSelectEnd, doSelectFinal, doSelecting};
