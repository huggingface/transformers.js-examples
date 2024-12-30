import {
  AutoProcessor,
  AutoModelForImageClassification,
  interpolate_4d,
  RawImage,
  softmax,
} from "@huggingface/transformers";

export async function supportsWebGPU() {
  try {
    if (!navigator.gpu) return false;
    return !!(await navigator.gpu.requestAdapter());
  } catch (e) {
    return false;
  }
}

const webgpu = await supportsWebGPU();
// Load model and processor
const model_id = "onnx-community/dinov2-with-registers-small-with-attentions";
const model = await AutoModelForImageClassification.from_pretrained(model_id, {
  device: webgpu ? "webgpu" : "wasm",
  dtype: webgpu ? "q4" : "q8",
});
const processor = await AutoProcessor.from_pretrained(model_id);

self.postMessage({ type: "status", status: "ready" });

const MAX_IMAGE_SIZE = 800;
self.onmessage = async (event) => {
  const { image } = event.data;
  self.postMessage({ type: "status", status: "read_image" });

  let raw_image = await RawImage.read(image);
  if (raw_image.width > MAX_IMAGE_SIZE || raw_image.height > MAX_IMAGE_SIZE) {
    const aspect_ratio = raw_image.width / raw_image.height;
    let new_width, new_height;
    if (raw_image.width > raw_image.height) {
      new_width = MAX_IMAGE_SIZE;
      new_height = Math.round(MAX_IMAGE_SIZE / aspect_ratio);
    } else {
      new_height = MAX_IMAGE_SIZE;
      new_width = Math.round(MAX_IMAGE_SIZE * aspect_ratio);
    }
    raw_image = await raw_image.resize(new_width, new_height);
  }

  // Pre-process image
  const inputs = await processor(raw_image);

  self.postMessage({ type: "status", status: "run_model" });

  // Perform inference
  const { logits, attentions } = await model(inputs);

  self.postMessage({ type: "status", status: "postprocess" });

  // Get the predicted class
  const scores = logits[0];
  const probabilities = softmax(scores.data);
  const cls = scores.argmax().item();

  const score = probabilities[cls] * 100;
  const label = model.config.id2label[cls];
  console.log(`Predicted class: ${label}`);

  // Set config values
  const patch_size = model.config.patch_size;
  const [width, height] = inputs.pixel_values.dims.slice(-2);
  const w_featmap = Math.floor(width / patch_size);
  const h_featmap = Math.floor(height / patch_size);
  const num_heads = model.config.num_attention_heads;
  const num_cls_tokens = 1;
  const num_register_tokens = model.config.num_register_tokens ?? 0;

  // Visualize attention maps
  const output = [];
  for (let i = 0; i < attentions.length; ++i) {
    const layer = attentions[i];

    const selected_attentions = layer
      .slice(0, null, 0, [num_cls_tokens + num_register_tokens, null])
      .view(num_heads, 1, w_featmap, h_featmap);

    const upscaled = await interpolate_4d(selected_attentions, {
      size: [width, height],
      mode: "nearest",
    });

    for (let j = 0; j < num_heads; ++j) {
      const head_attentions = upscaled[j];
      const minval = head_attentions.min().item();
      const maxval = head_attentions.max().item();
      const map = RawImage.fromTensor(
        head_attentions
          .sub_(minval)
          .div_(maxval - minval)
          .mul_(255)
          .to("uint8"),
      ).rgba();
      const image = await createImageBitmap(
        new ImageData(map.data, map.width, map.height),
        {
          imageOrientation: "flipY",
        },
      );
      output.push({
        layer: i,
        head: j,
        num_heads,
        image,
      });
    }
  }

  self.postMessage({
    type: "output",
    result: {
      attentions: output,
      label,
      score,
    },
  });
};
