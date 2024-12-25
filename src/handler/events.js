import { selection, node, doPhases, doPhasesReversed } from "@/vars";
import { is } from "@/modes";
import { emit } from "@/lib/emit";

function elementReplacePhases(id, state) {
  id = id.startsWith("do")
    ? id
    : "do" + id.charAt(0).toUpperCase() + id.slice(1);
  const fromto = state ? doPhases : doPhasesReversed;
  document
    .getElementById(id)
    .classList.replace(...fromto);
}

function handleFloodFillEvent() {
  if (e.detail.phase === "start") {
    document
      .getElementById("fillSelectionImageButton")
      .classList.replace("inactive", "active");
    document.getElementById("doDelete").classList.replace("inactive", "active");
  }
}

function handleChangeNodePath() {
  if (selection.size === 0) {
    is.changeNodePath = false;
    if (node.isMagnetic) {
      node.isMagnetic = false;
      emit.send("isMagneticNode");
    }
    return;
  }
  if (is.changeNodePath) {
    if (node.isMagnetic) {
      node.isMagnetic = false;
      emit.send("isMagneticNode");
    }
    if (is.drawPath) {
      emit.send("drawPath");
    }
    if (is.deleteNodePath) {
      emit.send("deleteNodePath");
    }
  }
  elementReplacePhases("changeNodePath", is.changeNodePath);
}

function handleAddNodePath() {
  if (selection.size === 0) {
    is.addNodePath = false;
    if (node.isMagnetic) {
      node.isMagnetic = false;
      emit.send("isMagneticNode");
    }
    document
      .getElementById("doAddNodePath")
      .classList.replace("active", "inactive");
    return;
  }
  if (!is.addNodePath && node.isMagnetic) {
    node.isMagnetic = false;
    emit.send("isMagneticNode");
  }
  elementReplacePhases("addNodePath", is.addNodePath);
}

function handleDeleteNodePath() {
  if (selection.size === 0) {
    is.deleteNodePath = false;
    if (node.isMagnetic) {
      node.isMagnetic = false;
      emit.send("isMagneticNode");
    }
    document.getElementById("doDeleteNodePath").classList.add("inactive");
    return;
  }

  if (is.deleteNodePath && node.isMagnetic) {
    node.isMagnetic = false;
    emit.send("isMagneticNode");
  }
  elementReplacePhases("deleteNodePath", is.deleteNodePath);
}

function handleMagneticNode() {
  elementReplacePhases("magneticNode", node.isMagnetic);
}

emit.receive("floodfill", handleFloodFillEvent);
emit.receive("changeNodePath", handleChangeNodePath);
emit.receive("addNodePath", handleAddNodePath);
emit.receive("deleteNodePath", handleDeleteNodePath);
emit.receive("isMagneticNode", handleMagneticNode);
