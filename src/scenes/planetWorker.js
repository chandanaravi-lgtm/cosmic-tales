import { planetPixels } from './planetPixels.js';

/** Off-main-thread planet texture generation (see proceduralTextures.js). */
self.onmessage = ({ data: { recipe, width } }) => {
  const pixels = planetPixels(recipe, width);
  self.postMessage({ recipe, width, pixels }, [pixels.buffer]);
};
