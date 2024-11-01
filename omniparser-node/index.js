import { RawImage } from "@huggingface/transformers";
import { Detector } from "./detector.js";
import { Caption } from "./captioning.js";

// Load detection model
const detector_model_id = "onnx-community/OmniParser-icon_detect";
const detector = await Detector.from_pretrained(detector_model_id);

// Load captioning model
const captioning_model_id = "onnx-community/Florence-2-base-ft";
const captioning = await Caption.from_pretrained(captioning_model_id);

// Read image from URL
const url =
  "https://raw.githubusercontent.com/microsoft/OmniParser/refs/heads/master/imgs/google_page.png";
const image = await RawImage.read(url);

// Run detection
const detections = await detector.predict(image, {
  confidence_threshold: 0.05,
  iou_threshold: 0.7,
});

for (const { x1, x2, y1, y2, score } of detections) {
  // Crop image
  const bbox = [x1, y1, x2, y2].map(Math.round);
  const cropped_image = await image.crop(bbox);

  // Run captioning
  const text = await captioning.describe(cropped_image);
  console.log({ text, bbox, score });
}
