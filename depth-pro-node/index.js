import {
  AutoProcessor,
  AutoModelForDepthEstimation,
  RawImage,
} from "@huggingface/transformers";

// Load model and processor
const depth = await AutoModelForDepthEstimation.from_pretrained(
  "onnx-community/DepthPro-ONNX",
  { dtype: "q4" },
);
const processor = await AutoProcessor.from_pretrained(
  "onnx-community/DepthPro-ONNX",
);

// Read and prepare image
const image = await RawImage.read("./assets/image.jpg");
const inputs = await processor(image);

// Run depth estimation model
const { predicted_depth, focallength_px } = await depth(inputs);

// Visualize the depth map
const depth_map_data = predicted_depth.data;
let minDepth = Infinity;
let maxDepth = -Infinity;
for (let i = 0; i < depth_map_data.length; ++i) {
  minDepth = Math.min(minDepth, depth_map_data[i]);
  maxDepth = Math.max(maxDepth, depth_map_data[i]);
}

// Normalize the depth map to [0, 1]
const depth_tensor = predicted_depth
  .sub_(minDepth)
  .div_(-(maxDepth - minDepth)) // Flip for visualization purposes
  .add_(1)
  .clamp_(0, 1)
  .mul_(255)
  .round_()
  .to("uint8");

// Save the depth map
const depth_image = RawImage.fromTensor(depth_tensor);
depth_image.save("./assets/depth.png");
