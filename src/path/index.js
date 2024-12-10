import {stage, imageLayer, imageTransformer} from '@/init/layers';
import {is} from '@/modes';
import {setLastPos, } from '@/last-position';
import {previewLine} from '@/previewline';
import {color, selection,} from '@/vars';
import {createPath} from '@/path/create';
import {destroyHandleCircles} from '@/path/handle-circles';

const STROKE_WIDTH = 1;
const STROKE_COLOR = '#fff';
const STROKE_DASH = [8, 4];
const PATH_OPACITY = 0.2;

let currentPathId = null;
function setCurrentPathId(v) {
  currentPathId = v;
}

// Function to handle mouse click to begin/add points to the path
function doDrawPathing(kevt) {
  if (!is.drawPath) return;
  // double click
  if (kevt.evt.detail > 1) return; 

  console.log(selection);

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

  var pos = stage.getRelativePointerPosition();
  if (! setLastPos(pos)) return;

  let currentPath;
  if (!currentPathId) {
    currentPathId = `Path${Math.random().toString(36).slice(2)}`;
    currentPath = createPath(currentPathId);
  } else {
    currentPath = imageLayer.findOne(`#${currentPathId}`);
  }

  if (! currentPath) return;

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

  resetPathState();

  // Enable the "Fill Path" button and color picker after the path is closed
  document.getElementById('doFill').disabled = false;
  document.getElementById('fillColorPicker').disabled = false;
  document.getElementById('doDelete').disabled = false; // Enable delete button

  imageLayer.batchDraw();
}

// Function to reset drawing state
function resetPathState() {
  setCurrentPathId(null);
  setLastPos(null);
}

export {STROKE_WIDTH, STROKE_COLOR, STROKE_DASH, PATH_OPACITY};
export {currentPathId, setCurrentPathId, doDrawPathing, handleStageDblClick, resetPathState};
