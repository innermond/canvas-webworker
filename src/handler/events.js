import {selection, doPhases, doPhasesReversed} from '@/vars';
import {is} from '@/modes';
import {emit} from '@/emit';

function elementReplacePhases(id, state) {
  id = id.startsWith('do') ? id : 'do' + id.charAt(0).toUpperCase() + id.slice(1);
  document.getElementById(id).classList.replace.apply(document.getElementById(id).classList, state ? doPhases : doPhasesReversed);
}

function handleFloodFillEvent(e) {
  if (e.detail.phase === 'start') {
    document.getElementById('fillSelectionImageButton').classList.replace('inactive', 'active');
    document.getElementById('doDelete').classList.replace('inactive', 'active');
  }
}

function handleChangeNodePath() {
  if (selection.size === 0) {
    is.changeNodePath = false;
    document.getElementById('doChangeNodePath').classList.replace('active', 'inactive');
    return;
  }
  if (is.changeNodePath) {
    document.getElementById('doDrawPath').classList.replace('active', 'inactive');
    document.getElementById('doDeleteNodePath').classList.replace('active', 'inactive');
  }
  elementReplacePhases('changeNodePath', is.changeNodePath);

}

function handleAddNodePath() {
  if (selection.size === 0) {
    is.addNodePath = false;
    document.getElementById('doAddNodePath').classList.replace('active', 'inactive');
    return;
  }
  elementReplacePhases('addNodePath', is.addNodePath);
}

function handleDeleteNodePath() {
  if (selection.size === 0) {
    is.deleteNodePath = false;
    document.getElementById('doDeleteNodePath').classList.add('inactive');
    return;
  }

  if (is.deleteNodePath) {
    document.getElementById('doDrawPath').classList.replace('active', 'inactive');
    document.getElementById('doChangeNodePath').classList.replace('active', 'inactive');
  }
  elementReplacePhases('deleteNodePath', is.deleteNodePath);
}

emit.receive('floodfill', handleFloodFillEvent);
emit.receive('changeNodePath', handleChangeNodePath);
emit.receive('addNodePath', handleAddNodePath);
emit.receive('deleteNodePath', handleDeleteNodePath);
