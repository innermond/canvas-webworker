import { is } from "@/modes";
import { stage, } from "@/init/layers";

// drag mode
stage.on("mousedown", (e) => {
  if (!is.drag) return;
  e.cancelBubble = true;

  stage.startDrag();
  document.body.style.cursor = "grab";
});
stage.on("mouseup", (e) => {
  if (!is.drag) return;
  e.cancelBubble = true;

  stage.stopDrag();
  document.body.style.cursor = "inherit";
});
stage.on("click", (e) => {
  if (!is.drag) return;
  e.cancelBubble = true;
});
