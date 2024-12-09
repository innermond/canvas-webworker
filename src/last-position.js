import {stage} from '@/init/layers';

// Variable to store the last clicked position
let lastPos = null;

function setLastPos(pos) {
  if (pos === null) {
    lastPos = pos;
    return
  }

  if (pos === undefined) {
    pos = stage.getRelativePointerPosition();
    round(pos);
    // no same point
    if (lastPos && lastPos.x === pos.x && lastPos.y === pos.y) {
      return;
    }
    lastPos = pos;
    return
  }

  round(pos);
  if (lastPos && lastPos.x === pos.x && lastPos.y === pos.y) {
    return;
  }
  lastPos = pos;
}

function round(v) {
  v.x = Math.round(v.x);
  v.y = Math.round(v.y);
}

export {lastPos, setLastPos};
