import {is, mode} from '@/modes';
import {stage, bucketLayer, } from '@/init/layers';
import {setLastPos} from '@/last-position';
import {floodFillWorker} from '@/floodfill';
import {color} from '@/vars';

async function fillBucket(cobaiImage) {
  const bucketOrSelectImage = is.bucket || is.magikWand;
  if (!bucketOrSelectImage || !cobaiImage || !cobaiImage?.parent) return;

  setLastPos(cobaiImage.getRelativePointerPosition());

  // Get raw native image behind currentImage
  const imageElement = cobaiImage.image();
  // Native (unscaled) dimensions of image
  const width = imageElement.width;
  const height = imageElement.height;

  // Get native image data to be sent outside to the worker
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = width;
  imageCanvas.height = height;
  const imageCtx = imageCanvas.getContext('2d');
  // fiil our imageCanvas with native imageElement
  imageCtx.drawImage(imageElement, 0, 0);

  // Get pos on a transformed currentImage (through stage's transformation)
  const localPos = cobaiImage.getRelativePointerPosition();
  const startPos = {
    x: Math.round(localPos.x),
    y: Math.round(localPos.y),
  };

  const bucketImage = await collapseBucketLayer();
  const bucketBmp = await createImageBitmap(bucketImage.image());
  imageCtx.drawImage(bucketBmp, 0, 0,);
  const imageData = imageCtx.getImageData(0, 0, width, height);

  // Send image data and other details to the web worker
  floodFillWorker.postMessage({
    imageData,
    startPos,
    fillColor: color.fill,
    tolerance: color.sensitivity,
    justContour: is.magikWand,
  });
}

async function getImageDataComposedWithBucket(kimage) {
  // Get raw native image behind currentImage
  const imageElement = kimage.image();
  // Native (unscaled) dimensions of image
  const width = imageElement.width;
  const height = imageElement.height;

  // Get native image data to be sent outside to the worker
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = width;
  imageCanvas.height = height;
  const imageCtx = imageCanvas.getContext('2d');
  // fiil our imageCanvas with native imageElement
  imageCtx.drawImage(imageElement, 0, 0);

  const bucketImage = getAsRawImage(bucketLayer);
  const bucketBmp = await createImageBitmap(bucketImage.image());
  imageCtx.drawImage(bucketBmp, 0, 0,);
  const imageData = imageCtx.getImageData(0, 0, width, height);

  return imageData;
}

function collapseBucketLayer() {
  const bucketImage = getAsRawImage(bucketLayer);
  bucketLayer.destroyChildren();
  bucketLayer.add(bucketImage);

  return bucketImage;
}

function getAsRawImage(layer) {
  Konva.autoDrawEnabled = false;

  const { x, y, scaleX, scaleY, width, height, } = stage.attrs;
  const old = { x, y, scaleX, scaleY, width, height };

  const w = layer.width();
  const h = layer.height();
  // Reset stage (no skew or rotation)
  stage.setAttrs({
    x: 0, y: 0,
    scaleX: 1, scaleY: 1,
    width: w, height: h,
  });

  const canvas = layer.toCanvas();
  const image = new Konva.Image({
    x: 0, y: 0,
    width: w,
    height: h,
    image: canvas,
  });

  // Transform back
  stage.setAttrs(old);

  Konva.autoDrawEnabled = true;

  return image;
}

export {fillBucket, getImageDataComposedWithBucket, collapseBucketLayer, getAsRawImage};
