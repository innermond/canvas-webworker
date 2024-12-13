import {emit} from '@/emit';

function handleFloodFillEvent(e) {
  if (e.detail.phase === 'start') {
    document.getElementById('fillSelectionImageButton').classList.replace('inactive', 'active');
    document.getElementById('doDelete').classList.replace('inactive', 'active');
  }
}

emit.receive('floodfill', handleFloodFillEvent);
