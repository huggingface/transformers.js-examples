import {
  AutoProcessor,
  SapiensForSemanticSegmentation,
  SapiensForDepthEstimation,
  SapiensForNormalEstimation,
  RawImage,
  interpolate_4d,
} from "@huggingface/transformers";

// Load segmentation, depth, and normal estimation models
const segment = await SapiensForSemanticSegmentation.from_pretrained(
  "onnx-community/sapiens-seg-0.3b",
  { dtype: "q8" },
);
const depth = await SapiensForDepthEstimation.from_pretrained(
  "onnx-community/sapiens-depth-0.3b",
  { dtype: "q4" },
);
const normal = await SapiensForNormalEstimation.from_pretrained(
  "onnx-community/sapiens-normal-0.3b",
  { dtype: "q4" },
);

// Load processor
const processor = await AutoProcessor.from_pretrained(
  "onnx-community/sapiens-seg-0.3b",
);

// Read and prepare image
const image = await RawImage.read("./assets/image.jpg");
const inputs = await processor(image);

// Run segmentation model
console.time("segmentation");
const segmentation_outputs = await segment(inputs); // [1, 28, 512, 384]
console.timeEnd("segmentation");
const { segmentation } =
  processor.feature_extractor.post_process_semantic_segmentation(
    segmentation_outputs,
    inputs.original_sizes,
  )[0];

// Run depth estimation model
console.time("depth");
const { predicted_depth } = await depth(inputs); // [1, 1, 1024, 768]
console.timeEnd("depth");

// Run normal estimation model
console.time("normal");
const { predicted_normal } = await normal(inputs); // [1, 3, 512, 384]
console.timeEnd("normal");

console.time("post-processing");

// Resize predicted depth and normal maps to the original image size
const size = [image.height, image.width];
const depth_map = await interpolate_4d(predicted_depth, { size });
const normal_map = await interpolate_4d(predicted_normal, { size });

// Use the segmentation mask to remove the background
const stride = size[0] * size[1];
const depth_map_data = depth_map.data;
const normal_map_data = normal_map.data;
let minDepth = Infinity;
let maxDepth = -Infinity;
let maxAbsNormal = -Infinity;
for (let i = 0; i < depth_map_data.length; ++i) {
  if (segmentation.data[i] === 0) {
    // Background
    depth_map_data[i] = Infinity;

    for (let j = 0; j < 3; ++j) {
      normal_map_data[j * stride + i] = -Infinity;
    }
  } else {
    // Foreground
    minDepth = Math.min(minDepth, depth_map_data[i]);
    maxDepth = Math.max(maxDepth, depth_map_data[i]);
    for (let j = 0; j < 3; ++j) {
      maxAbsNormal = Math.max(
        maxAbsNormal,
        Math.abs(normal_map_data[j * stride + i]),
      );
    }
  }
}

// Normalize the depth map to [0, 1]
const depth_tensor = depth_map
  .sub_(minDepth)
  .div_(-(maxDepth - minDepth)) // Flip for visualization purposes
  .add_(1)
  .clamp_(0, 1)
  .mul_(255)
  .round_()
  .to("uint8");

const normal_tensor = normal_map
  .div_(maxAbsNormal)
  .clamp_(-1, 1)
  .add_(1)
  .mul_(255 / 2)
  .round_()
  .to("uint8");

console.timeEnd("post-processing");

const depth_image = RawImage.fromTensor(depth_tensor[0]);
depth_image.save("assets/depth.png");

const normal_image = RawImage.fromTensor(normal_tensor[0]);
normal_image.save("assets/normal.png");
