import {
  SamModel,
  AutoProcessor,
  RawImage,
  Tensor,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.1";

// Reference the elements we will use
const statusLabel = document.getElementById("status");
const fileUpload = document.getElementById("upload");
const imageContainer = document.getElementById("container");
const example = document.getElementById("example");
const uploadButton = document.getElementById("upload-button");
const resetButton = document.getElementById("reset-image");
const clearButton = document.getElementById("clear-points");
const cutButton = document.getElementById("cut-mask");
const starIcon = document.getElementById("star-icon");
const crossIcon = document.getElementById("cross-icon");
const maskCanvas = document.getElementById("mask-output");
const maskContext = maskCanvas.getContext("2d");

const EXAMPLE_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/corgi.jpg";

// State variables
let isEncoding = false;
let isDecoding = false;
let decodePending = false;
let lastPoints = null;
let isMultiMaskMode = false;
let imageInput = null;
let imageProcessed = null;
let imageEmbeddings = null;

async function decode() {
  // Only proceed if we are not already decoding
  if (isDecoding) {
    decodePending = true;
    return;
  }
  isDecoding = true;

  // Prepare inputs for decoding
  const reshaped = imageProcessed.reshaped_input_sizes[0];
  const points = lastPoints
    .map((x) => [x.position[0] * reshaped[1], x.position[1] * reshaped[0]])
    .flat(Infinity);
  const labels = lastPoints.map((x) => BigInt(x.label)).flat(Infinity);

  const num_points = lastPoints.length;
  const input_points = new Tensor("float32", points, [1, 1, num_points, 2]);
  const input_labels = new Tensor("int64", labels, [1, 1, num_points]);

  // Generate the mask
  const { pred_masks, iou_scores } = await model({
    ...imageEmbeddings,
    input_points,
    input_labels,
  });

  // Post-process the mask
  const masks = await processor.post_process_masks(
    pred_masks,
    imageProcessed.original_sizes,
    imageProcessed.reshaped_input_sizes,
  );

  isDecoding = false;

  updateMaskOverlay(RawImage.fromTensor(masks[0][0]), iou_scores.data);

  // Check if another decode is pending
  if (decodePending) {
    decodePending = false;
    decode();
  }
}

function updateMaskOverlay(mask, scores) {
  // Update canvas dimensions (if different)
  if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
    maskCanvas.width = mask.width;
    maskCanvas.height = mask.height;
  }

  // Allocate buffer for pixel data
  const imageData = maskContext.createImageData(
    maskCanvas.width,
    maskCanvas.height,
  );

  // Select best mask
  const numMasks = scores.length; // 3
  let bestIndex = 0;
  for (let i = 1; i < numMasks; ++i) {
    if (scores[i] > scores[bestIndex]) {
      bestIndex = i;
    }
  }
  statusLabel.textContent = `Segment score: ${scores[bestIndex].toFixed(2)}`;

  // Fill mask with colour
  const pixelData = imageData.data;
  for (let i = 0; i < pixelData.length; ++i) {
    if (mask.data[numMasks * i + bestIndex] === 1) {
      const offset = 4 * i;
      pixelData[offset] = 0; // red
      pixelData[offset + 1] = 114; // green
      pixelData[offset + 2] = 189; // blue
      pixelData[offset + 3] = 255; // alpha
    }
  }

  // Draw image data to context
  maskContext.putImageData(imageData, 0, 0);
}

function clearPointsAndMask() {
  // Reset state
  isMultiMaskMode = false;
  lastPoints = null;

  // Remove points from previous mask (if any)
  document.querySelectorAll(".icon").forEach((e) => e.remove());

  // Disable cut button
  cutButton.disabled = true;

  // Reset mask canvas
  maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
}
clearButton.addEventListener("click", clearPointsAndMask);

resetButton.addEventListener("click", () => {
  // Reset the state
  imageInput = null;
  imageProcessed = null;
  imageEmbeddings = null;
  isEncoding = false;
  isDecoding = false;

  // Clear points and mask (if present)
  clearPointsAndMask();

  // Update UI
  cutButton.disabled = true;
  imageContainer.style.backgroundImage = "none";
  uploadButton.style.display = "flex";
  statusLabel.textContent = "Ready";
});

async function encode(url) {
  if (isEncoding) return;
  isEncoding = true;
  statusLabel.textContent = "Extracting image embedding...";

  imageInput = await RawImage.fromURL(url);

  // Update UI
  imageContainer.style.backgroundImage = `url(${url})`;
  uploadButton.style.display = "none";
  cutButton.disabled = true;

  // Recompute image embeddings
  imageProcessed = await processor(imageInput);
  imageEmbeddings = await model.get_image_embeddings(imageProcessed);

  statusLabel.textContent = "Embedding extracted!";
  isEncoding = false;
}

// Handle file selection
fileUpload.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  // Set up a callback when the file is loaded
  reader.onload = (e2) => encode(e2.target.result);

  reader.readAsDataURL(file);
});

example.addEventListener("click", (e) => {
  e.preventDefault();
  encode(EXAMPLE_URL);
});

// Attach hover event to image container
imageContainer.addEventListener("mousedown", (e) => {
  if (e.button !== 0 && e.button !== 2) {
    return; // Ignore other buttons
  }
  if (!imageEmbeddings) {
    return; // Ignore if not encoded yet
  }
  if (!isMultiMaskMode) {
    lastPoints = [];
    isMultiMaskMode = true;
    cutButton.disabled = false;
  }

  const point = getPoint(e);
  lastPoints.push(point);

  // add icon
  const icon = (point.label === 1 ? starIcon : crossIcon).cloneNode();
  icon.style.left = `${point.position[0] * 100}%`;
  icon.style.top = `${point.position[1] * 100}%`;
  imageContainer.appendChild(icon);

  // Run decode
  decode();
});

// Clamp a value inside a range [min, max]
function clamp(x, min = 0, max = 1) {
  return Math.max(Math.min(x, max), min);
}

function getPoint(e) {
  // Get bounding box
  const bb = imageContainer.getBoundingClientRect();

  // Get the mouse coordinates relative to the container
  const mouseX = clamp((e.clientX - bb.left) / bb.width);
  const mouseY = clamp((e.clientY - bb.top) / bb.height);

  return {
    position: [mouseX, mouseY],
    label:
      e.button === 2 // right click
        ? 0 // negative prompt
        : 1, // positive prompt
  };
}

// Do not show context menu on right click
imageContainer.addEventListener("contextmenu", (e) => e.preventDefault());

// Attach hover event to image container
imageContainer.addEventListener("mousemove", (e) => {
  if (!imageEmbeddings || isMultiMaskMode) {
    // Ignore mousemove events if the image is not encoded yet,
    // or we are in multi-mask mode
    return;
  }
  lastPoints = [getPoint(e)];

  decode();
});

// Handle cut button click
cutButton.addEventListener("click", async () => {
  const [w, h] = [maskCanvas.width, maskCanvas.height];

  // Get the mask pixel data (and use this as a buffer)
  const maskImageData = maskContext.getImageData(0, 0, w, h);

  // Create a new canvas to hold the cut-out
  const cutCanvas = new OffscreenCanvas(w, h);
  const cutContext = cutCanvas.getContext("2d");

  // Copy the image pixel data to the cut canvas
  const maskPixelData = maskImageData.data;
  const imagePixelData = imageInput.data;
  for (let i = 0; i < w * h; ++i) {
    const sourceOffset = 3 * i; // RGB
    const targetOffset = 4 * i; // RGBA

    if (maskPixelData[targetOffset + 3] > 0) {
      // Only copy opaque pixels
      for (let j = 0; j < 3; ++j) {
        maskPixelData[targetOffset + j] = imagePixelData[sourceOffset + j];
      }
    }
  }
  cutContext.putImageData(maskImageData, 0, 0);

  // Download image
  const link = document.createElement("a");
  link.download = "image.png";
  link.href = URL.createObjectURL(await cutCanvas.convertToBlob());
  link.click();
  link.remove();
});

const model_id = "Xenova/slimsam-77-uniform";
statusLabel.textContent = "Loading model...";
const model = await SamModel.from_pretrained(model_id, {
  dtype: "fp16", // or "fp32"
  device: "webgpu",
});
const processor = await AutoProcessor.from_pretrained(model_id);
statusLabel.textContent = "Ready";

// Enable the user interface
fileUpload.disabled = false;
uploadButton.style.opacity = 1;
example.style.pointerEvents = "auto";
