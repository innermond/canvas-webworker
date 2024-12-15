const STROKE_WIDTH = 1;
const STROKE_COLOR = '#fff';
const STROKE_DASH = [8, 4];
const PATH_OPACITY = 0.2;
const blendColorDefault = 'source-over';

const color = {
  fill: '#000000',
  sensitivity: 25,
  opacity: 100,
  blend: blendColorDefault, 
}

const node = {
  isMagnetic: false,
}

const doPhases = ['inactive', 'active'];
const doPhasesReversed = [...doPhases].reverse();

const selection = new Set();

export {color, node, selection, doPhases, doPhasesReversed};
export {STROKE_COLOR, STROKE_WIDTH, STROKE_DASH, PATH_OPACITY};
