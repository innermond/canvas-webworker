import {stage, imageLayer} from '@/init/layers';
import {is} from '@/modes';
import {STROKE_WIDTH} from '@/path';
import {animation01} from '@/animation';

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
const selection = new Set();
function doSelectEnd(e) {
  if (! is.select) return;
  e.cancelBubble = true;
  
  addNodesToSelection();
  imageLayer.findOne('#selectingRect')?.destroy();
  selectPoints[0] = {x: 0, y: 0};
  selectPoints[1] = {x: 0, y: 0};
}
function addNodesToSelection() {
  const sr = imageLayer.findOne('#selectingRect');
  if (!sr) return;

  const box = sr.getClientRect();
  stage.children.forEach(s => {
    if (s.visible() === false) return;
    if (Konva.Util.haveIntersection(box, s.getClientRect) === false) return;
    selection.add(s);
  });
}
function doSelecting(e) {
  if (!is.select) return;
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
  e.cancelBubble = true;
}

export {doSelectStart, doSelectEnd, doSelectFinal, doSelecting};
