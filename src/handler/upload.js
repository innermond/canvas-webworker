import {stage, imageLayer, imageTransformer} from '@/init/layers';
import {is, } from '@/modes';
import {previewLine} from '@/previewline'; 
import {selection} from '@/vars';
import {setLastPos} from '@/last-position';

let  imageScaleX, imageScaleY;

function imageUpload(e) {
  const file = e.target.files[0];
  if (!file) {
    return; // Exit if no file is selected
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const { width: pwidth, height: pheight } = document.querySelector('#container').style;
      const stageApparentWidth = parseInt(pwidth); //stage.width();
      const stageApparentHeight = parseInt(pheight); //stage.height();
      const imgWidth = img.width;
      const imgHeight = img.height;

      // Calculate aspect ratios
      const stageAspectRatio = stageApparentWidth / stageApparentHeight;
      const imgAspectRatio = imgWidth / imgHeight;

      // Determine how to scale the image to fit within the stage
      let newWidth, newHeight;
      if (imgAspectRatio > stageAspectRatio) {
        // Image is wider than the stage, scale by width
        newWidth = stageApparentWidth;
        newHeight = (imgHeight * stageApparentWidth) / imgWidth;
      } else {
        // Image is taller than the stage, scale by height
        newHeight = stageApparentHeight;
        newWidth = (imgWidth * stageApparentHeight) / imgHeight;
      }
      // Calculate the scaling factors
      imageScaleX = newWidth / imgWidth; // Scale factor for the width
      imageScaleY = newHeight / imgHeight; // Scale factor for the height
      // FIXME
      stage.width(img.width)
      stage.height(img.height)
      stage.container().querySelector('* > div').style.transform = `scale(${Math.max(imageScaleX, imageScaleY)})`;

      const newImage = new Konva.Image({
        image: img,
      });
      imageLayer.add(newImage);
      if (previewLine.parent !== null) {
        previewLine?.zIndex(imageLayer.children.length-1);
      }

      newImage.on('mousedown', function(e) {
        if (is.magikWand) return;
        if (is.drawPencil) return; 
        if (is.select) return; 
        e.target.startDrag();
        if (is.bucket) {
          e.target.stopDrag();
        }
      });
      newImage.on('mouseup', function(e) {
        if (is.select) return; 
        e.target.stopDrag();
        if (is.bucket) return; 
        if (is.drawPath) return; 
        if (is.drawPencil) return; 
        if (is.select) return; 
        if (is.drag) return; 
        
        imageTransformer.nodes([]);
        const inx = imageTransformer.nodes().indexOf(e.target);
        if (inx === -1) { // not found exclusively add it
          imageTransformer.nodes([]);
          imageTransformer.nodes([e.target]);
        } else { // found remove it
          const nodes = imageTransformer.nodes().slice();
          nodes.splice(inx, 1);
          imageTransformer.nodes(nodes);
        }
      });
      newImage.on('click', function(e) {
        if (is.drawPath) return;
        if (is.select) return; 

        e.evt.preventDefault();
        
        selection.clear();
        imageTransformer.nodes([]);
        selection.add(e.target);

        const pos = stage.getRelativePointerPosition();
        setLastPos(pos);
        
        document.getElementById('doDelete').disabled = false; // Enable delete button
      });

      imageLayer.batchDraw(); // Redraw the imageLayer to show the image

      document.getElementById('doDelete').disabled = false; // Enable delete button after image is added
    };
    img.src = event.target.result; // Set image source to the file's data URL
  };

  reader.readAsDataURL(file); // Read the file as a data URL
}

export {imageUpload};
