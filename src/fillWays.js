import createModes from "@/lib/create-modes";
import { color } from "@/vars";

const labels = ["protect", "clean"];
const { modes: fillWays, mode: fillWay, is: isFillWay } = createModes(labels);

function gco() {
  const v = isFillWay.clean
    ? "destination-out"
    : isFillWay.protect
      ? "destination-over"
      : color.blend;
  return v;
}

export { fillWays, fillWay, isFillWay, gco, labels };
