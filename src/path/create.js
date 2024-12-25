import {stage, imageLayer, imageTransformer} from '@/init/layers';
import {is} from '@/modes';
import {setLastPos, round} from '@/last-position';
import {animation01} from '@/animation';
import {node, selection} from '@/vars';
import {STROKE_WIDTH, STROKE_COLOR, STROKE_DASH, PATH_OPACITY, } from '@/path';
import {destroyHandleCircles, createHandleCircles, } from '@/path/handle-circles';
import {closestProjectedPoint, getVerticesFromPathData, generatePathDataFromVertices, } from '@/path/funcs';

function createPath(currentPathId) {
  if (currentPathId === undefined) {
    currentPathId = `Path${Math.random().toString(36).slice(2)}`;
  }
  
  const currentPath = new Konva.Path({
    data: '',
    stroke: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
    dash: STROKE_DASH,
    fill: '',
    id: currentPathId,
    strokeScaleEnabled: false,
  });
  imageLayer.add(currentPath);

  currentPath.on('click', function(evt) {
    //if (is.select) return;
    if (is.drag) return;
    if (is.drawPath) return;
    evt.cancelBubble = true;
   
    //if (selection.has(this) && !is.addNodePath) {
    //  selection.delete(this);
    //  this.strokeWidth(0);
    //  this.draggable(false);
    //  destroyHandleCircles();
    //  imageTransformer.nodes(Array.from(selection.values()));
    //  return;
    //} 
 
    const wasInSelection = selection.has(this);
    // reset
    selection.forEach(v => {
      v.strokeWidth(0);
      v.draggable(false);
    });
    destroyHandleCircles();
    selection.clear();
    if (! wasInSelection) {
      this.strokeWidth(STROKE_WIDTH);
      this.draggable(true);
      selection.add(this);
    }
    createHandleCircles(true);
    imageTransformer.nodes(Array.from(selection.values()));
    
    if (is.addNodePath) {
      let clickPoint = this.getRelativePointerPosition();
      round(clickPoint);
      const [vertices, types] = getVerticesFromPathData(this.data());
      const [newPoint, index] = closestProjectedPoint(vertices, clickPoint);
      vertices.splice(index, 0, newPoint);
      let type = 'L';
      if (node.isMagnetic) {
        type = 'Q';
      }
      types.set(newPoint, type);
      const pathData = generatePathDataFromVertices(vertices, types);
      this.data(pathData);
      destroyHandleCircles();
      createHandleCircles(true);
      imageLayer.batchDraw();
      return;
    }

    animation01(() => !selection.has(this), (applyInvert) => {
      if (applyInvert) {
        this.dash([4, 4]);
      } else {
        this.dash([8, 4]);
      }
      this.dashOffset(this.dashOffset() + 4);
    });

    imageLayer.batchDraw();
    setLastPos(null); // Reset last position for drawing

    // Update button states
    document.getElementById('doDelete').disabled = false; // Enable the delete button
    document.getElementById('doFill').disabled = false; // Enable the fill button
    document.getElementById('fillColorPicker').disabled = false; // Enable the fill color picker
  });

  currentPath.on('mousedown', function(evt) {
    if (is.drawPath) return;
    if (is.drag) return;
    evt.cancelBubble = true;
    if (is.drag && !selection.has(this)) {
      evt.cancelBubble = false;
    }
    if (ghostNode && selection.has(this)) {
      ghostNode.setAttrs({fill: 'red', opacity: 1});
    }
    if (selection.has(this)) {
      document.body.style.cursor = 'grab';
    }
  });
  currentPath.on('mouseup', function(e) {
    if (is.select) return;
    if (is.drawPath) return;
    if (is.drag) return;
    imageTransformer.nodes([]);
    const inx = imageTransformer.nodes().indexOf(e.target);
    if (inx === -1) { // not found exclusively add it
      imageTransformer.nodes([]);
      !is.drawPath && imageTransformer.nodes([e.target]);
    } else { // found remove it
      const nodes = imageTransformer.nodes().slice();
      nodes.splice(inx, 1);
      imageTransformer.nodes(nodes);
    }
    e.cancelBubble = true;
    if (is.drag && !selection.has(this)) {
      e.cancelBubble = false;
    }
    if (is.addNodePath && ghostNode) {
      ghostNode.setAttrs({fill: 'white', opacity: 0.4});
    }
    document.body.style.cursor = 'default';
  });
  currentPath.on('dragstart', function(evt) {
    evt.cancelBubble = true;
    if (ghostNode && selection.has(this) && is.addNodePath) {
      ghostNode.setAttrs({fill: 'white', opacity: 0.4});
    }
    this.opacity(PATH_OPACITY);
  });
  currentPath.on('dragend', function(evt) {
    evt.cancelBubble = true;
    this.opacity(1);
   });
  currentPath.on('dragmove', function(evt) {
    evt.cancelBubble = true;
    if (is.drag && !selection.has(this)) {
      evt.cancelBubble = false;
    }
  });

  let ghostNode = null;
  let initialGhostPos = {x: 0, y: 0};
  currentPath.on('dragstart', () => {
    ghostNode = imageLayer.findOne('#ghost');
    if (! ghostNode) {
      return;
    }
    initialGhostPos = ghostNode.getAbsolutePosition();
    const tr = currentPath.getAbsoluteTransform();
    // relative to currentPath
    initialGhostPos = tr.copy().invert().point(initialGhostPos);
  });
  // Update circle positions on path move
  currentPath.on('dragmove transform', () => {
    // calculate everything in viewport(canvas's stage as it is seen on screen) space
    const tr = currentPath.getAbsoluteTransform();

    if (selection.has(currentPath) || is.deleteNodePath) {
      const [vertices, ] = getVerticesFromPathData(currentPath.data());
      const vertexCircles = imageLayer.find('.'+currentPath.id());
      vertexCircles.forEach((vertex) => {
        const {index} = vertex.attrs;
        if (!vertices[index]) {
          return;
        }
        const p = tr.point(vertices[index]);
        vertex.absolutePosition({
          x: p.x,
          y: p.y,
        });
      });
    }
    // TODO fix wrongly ghost's positioning!!!
    if (ghostNode) {
      const gtr = tr.point(initialGhostPos);
      gtr.x = Math.round(gtr.x);
      gtr.y = Math.round(gtr.y);
      ghostNode.absolutePosition(gtr);      
    }

    imageLayer.batchDraw();
  });

  currentPath.on('mousemove', () => {
    if (is.addNodePath && selection.has(currentPath)) {
      // canvas point (it is relative to viewport)
      let movingPoint = stage.getPointerPosition();
      // to currentPath related to viewport
      let itr = currentPath.getAbsoluteTransform().copy().invert();
      movingPoint = itr.point(movingPoint);
      movingPoint.x = Math.round(movingPoint.x);
      movingPoint.y = Math.round(movingPoint.y);
      const [vertices, ] = getVerticesFromPathData(currentPath.data());
      let [newPoint,] = closestProjectedPoint(vertices, movingPoint);
      if (ghostNode) {
        // newPoint is in currentPath coordinates space
        // ghostNode is inside imageLayer so get reference to imageLayer
        itr = currentPath.getAbsoluteTransform();
        newPoint = itr.point(newPoint);
        ghostNode.absolutePosition(newPoint);
        ghostNode.visible(true);
      }
    }
  });
  currentPath.on('mouseenter', () => {
    if (is.addNodePath) {
      ghostNode = new Konva.Circle({
        x: 0,
        y: 0,
        radius: 10,
        fill: 'white',
        opacity: 0.4,
        visible: true,
        id: 'ghost',
      });
      imageLayer.add(ghostNode);
    }
  });
  currentPath.on('mouseleave', () => {
    ghostNode?.destroy();
    ghostNode = null;
  });

  return currentPath;
}

export {createPath};
