import { bucketLayer, justContourLayer } from "@/init/layers";
import { gco } from "@/fillWays";
import { animation01 } from "@/animation";
import { selection } from "@/vars";
import { emit } from "@/emit";

const floodFillWorker = new Worker("floodfillWorker.js");

floodFillWorker.onmessage = async function (e) {
  // Receive a widthxheight image that has bucket zone surrounded by transparency
  // Image is just to be laid out
  const { justContour, floodImageData } = e.data;

  // Polite mode: take into account already draw pixels
  const floodBmp = await createImageBitmap(floodImageData);
  const floodImage = new Konva.Image({
    x: 0,
    y: 0,
    width: floodBmp.width,
    height: floodBmp.height,
    image: floodBmp,
    globalCompositeOperation: gco(),
  });

  if (!justContour) {
    selection.add(floodImage);
    bucketLayer.add(floodImage);
    bucketLayer.batchDraw();
  } else {
    floodImage.setAttr("id", "floodImageContour");
    justContourLayer.add(floodImage);
    justContourLayer.batchDraw();

    animation01(
      () => {
        if (!floodImage?.parent) {
          return true;
        }
        return false;
      },
      (applyInvert) => {
        if (applyInvert) {
          floodImage.cache();
          floodImage.filters([Konva.Filters.Invert]);
        } else {
          floodImage.clearCache();
          floodImage.filters([]);
        }
      }
    );
  }

  emit.send("floodfill", { phase: "start" });
};

export { floodFillWorker };
