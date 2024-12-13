import {stage, imageLayer, } from '@/init/layers';
import {is} from '@/modes';
import {setLastPos, } from '@/last-position';
import {previewLine} from '@/previewline';
import {color, selection,} from '@/vars';
import {STROKE_COLOR, STROKE_WIDTH, STROKE_DASH, PATH_OPACITY} from '@/vars';
import {createPath} from '@/path/create';
import {destroyHandleCircles} from '@/path/handle-circles';

// Function to handle mouse click to begin/add points to the path
function doDrawPathing(kevt) {
  if (!is.drawPath) return;
  // double click
  if (kevt.evt.detail > 1) return; 

  var pos = stage.getRelativePointerPosition();
  if (! setLastPos(pos)) return;

  let currentPath;
  if (selection.size === 0) {
    const currentPathId = `Path${Math.random().toString(36).slice(2)}`;
    currentPath = createPath(currentPathId);
    selection.add(currentPath);
  } else {
    [currentPath] = selection;
  }

  if (! currentPath) return;

  // Closed path has no need to add new point
  if (currentPath.attrs.data.endsWith('Z')) {
    destroyHandleCircles();
    currentPath.strokeWidth(0);
    currentPath.draggable(false);
    imageLayer.batchDraw();
    return;
  }

  currentPath.strokeWidth(STROKE_WIDTH);
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

  currentPath.data(pathData);
  imageLayer.batchDraw();
  kevt.evt.stopImmediatePropagation();
}

function handleStageDblClick() {
  if (selection.size === 0) return;

  previewLine?.remove();
  const [currentPath] = selection;
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
  selection.delete(currentPath);

  resetPathState();
  if (is.drawPath) {
    is.drawPath = false;
    document.getElementById('doDrawPath').classList.replace('active', 'inactive');
  }
  // Enable the "Fill Path" button and color picker after the path is closed
  document.getElementById('doFill').disabled = false;
  document.getElementById('fillColorPicker').disabled = false;
  document.getElementById('doDelete').disabled = false; // Enable delete button

  imageLayer.batchDraw();
}

// Function to reset drawing state
function resetPathState() {
  setLastPos(null);
}

export {STROKE_WIDTH, STROKE_COLOR, STROKE_DASH, PATH_OPACITY};
export {doDrawPathing, handleStageDblClick, resetPathState};
