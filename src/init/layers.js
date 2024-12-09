let { width: pwidth, height: pheight } = document.querySelector('#container').style;
// Set up the stage and imageLayer
var stage = new Konva.Stage({
    id: 'stage',
    container: 'container',
    width: parseInt(pwidth) ?? 200,
    height: parseInt(pheight) ?? 100,
});

// Order of layers is important
var imageLayer = new Konva.Layer({
    id: 'image',
});
var imageTransformer = new Konva.Transformer();
imageLayer.add(imageTransformer);
stage.add(imageLayer);

var bucketLayer = new Konva.Layer({
    id: 'bucket',
});
stage.add(bucketLayer);

var justContourLayer = new Konva.Layer({
    id: 'justContour',
});
stage.add(justContourLayer);

export {stage, imageLayer, bucketLayer, justContourLayer};
export {imageTransformer};
