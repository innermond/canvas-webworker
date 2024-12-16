import createModes from "@/create-modes";

const labels = [
  "drawPath",
  "addNodePath",
  "changeNodePath",
  "deleteNodePath",
  "drawPencil",
  "fill",
  "select",
  "bucket",
  "magikWand",
  "drag",
];
const { modes, mode, is } = createModes(labels);
export { modes, mode, is, labels };
