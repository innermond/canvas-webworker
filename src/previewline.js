import {stage, imageLayer, } from '@/init/layers';
import {is} from '@/modes';
import {lastPos, } from '@/last-position';
import {selection,} from '@/vars';
import {STROKE_COLOR, STROKE_WIDTH, STROKE_DASH,} from '@/vars';

// preview line
const previewLine = new Konva.Line({
  id: 'previewLine',
  points: [],
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  strokeScaleEnabled: false,
  lineCap: 'round',
  dash: STROKE_DASH,
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
  if (selection.size === 0 || !lastPos) return; // Don't preview if no path or no previous point
  if (!is.drawPath) return;
  e.cancelBubble = true;

  const pos = imageLayer.getRelativePointerPosition();

  previewLine.visible(true);
  // Update the previewLine to preview the line from the last position to the current mouse position
  previewLine?.points([lastPos.x, lastPos.y, pos.x, pos.y]);
  imageLayer.batchDraw();
});

export {previewLine};
