import { AutoModel, AutoProcessor, RawImage } from "@huggingface/transformers";

/**
 * @typedef {Object} Detection
 * @property {number} x1 The x-coordinate of the top-left corner.
 * @property {number} y1 The y-coordinate of the top-left corner.
 * @property {number} x2 The x-coordinate of the bottom-right corner.
 * @property {number} y2 The y-coordinate of the bottom-right corner.
 * @property {number} score The confidence score of the detection.
 */

/**
 * Compute Intersection over Union (IoU) between two detections.
 * @param {Detection} a The first detection.
 * @param {Detection} b The second detection.
 */
function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (a.x2 - a.x1) * (a.y2 - a.y1);
  const area2 = (b.x2 - b.x1) * (b.y2 - b.y1);
  const union = area1 + area2 - intersection;

  return intersection / union;
}

/**
 * Run Non-Maximum Suppression (NMS) on a list of detections.
 * @param {Detection[]} detections The list of detections.
 * @param {number} iouThreshold The IoU threshold for NMS.
 */
export function nms(detections, iouThreshold) {
  const result = [];
  while (detections.length > 0) {
    const best = detections.reduce((acc, detection) =>
      detection.score > acc.score ? detection : acc,
    );
    result.push(best);
    detections = detections.filter(
      (detection) => iou(detection, best) < iouThreshold,
    );
  }
  return result;
}

export class Detector {
  /**
   * Create a new YOLOv8 detector.
   * @param {import('@huggingface/transformers').PreTrainedModel} model The model to use for detection
   * @param {import('@huggingface/transformers').Processor} processor The processor to use for detection
   */
  constructor(model, processor) {
    this.model = model;
    this.processor = processor;
  }

  /**
   * Run detection on an image.
   * @param {RawImage|string|URL} input The input image.
   * @param {Object} [options] The options for detection.
   * @param {number} [options.confidence_threshold=0.25] The confidence threshold.
   * @param {number} [options.iou_threshold=0.7] The IoU threshold for NMS.
   * @returns {Promise<Detection[]>} The list of detections
   */
  async predict(
    input,
    { confidence_threshold = 0.25, iou_threshold = 0.7 } = {},
  ) {
    const image = await RawImage.read(input);
    const { pixel_values } = await this.processor(image);

    // Run detection
    const { output0 } = await this.model({ images: pixel_values });

    // Post-process output
    const permuted = output0[0].transpose(1, 0);
    // `permuted` is a Tensor of shape [ 5460, 5 ]:
    // - 5460 potential bounding boxes
    // - 5 parameters for each box:
    //   - first 4 are coordinates for the bounding boxes (x-center, y-center, width, height)
    //   - the last one is the confidence score

    // Format output
    const result = [];
    const [scaledHeight, scaledWidth] = pixel_values.dims.slice(-2);
    for (const [xc, yc, w, h, score] of permuted.tolist()) {
      // Filter if not confident enough
      if (score < confidence_threshold) continue;

      // Get pixel values, taking into account the original image size
      const x1 = ((xc - w / 2) / scaledWidth) * image.width;
      const y1 = ((yc - h / 2) / scaledHeight) * image.height;
      const x2 = ((xc + w / 2) / scaledWidth) * image.width;
      const y2 = ((yc + h / 2) / scaledHeight) * image.height;

      // Add to result
      result.push({ x1, x2, y1, y2, score });
    }

    return nms(result, iou_threshold);
  }

  static async from_pretrained(model_id) {
    const model = await AutoModel.from_pretrained(model_id, { dtype: "fp32" });
    const processor = await AutoProcessor.from_pretrained(model_id);
    return new Detector(model, processor);
  }
}
