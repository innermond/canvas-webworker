import {stage} from '@/init/layers';

// Variable to store the last clicked position
let lastPos = null;

function setLastPos(v) {
  lastPos = (v === undefined) ? stage.getRelativePointerPosition(): v;
}

export {lastPos, setLastPos};
