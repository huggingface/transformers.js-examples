import {
  AutoTokenizer,
  AutoModel,
  AutoProcessor,
  RawImage,
  dot,
  softmax,
  mean_pooling,
  layer_norm,
} from "@huggingface/transformers";

// Reference the elements that we will need
const status = document.getElementById("status");
const container = document.getElementById("container");
const video = document.getElementById("video");
const labelsInput = document.getElementById("labels");
const templateInput = document.getElementById("template");
const overlay = document.getElementById("overlay");

status.textContent = "Loading model (539MB)...";

// Load object detection pipeline
let tokenizer, text_model, processor, vision_model;
try {
  const text_model_id = "nomic-ai/nomic-embed-text-v1.5";
  // Load tokenizer and text model
  tokenizer = await AutoTokenizer.from_pretrained(text_model_id);
  text_model = await AutoModel.from_pretrained(text_model_id, {
    device: "webgpu",
    dtype: "q4",
  });

  // Load processor and vision model
  const vision_model_id = "nomic-ai/nomic-embed-vision-v1.5";
  processor = await AutoProcessor.from_pretrained(vision_model_id);
  vision_model = await AutoModel.from_pretrained(vision_model_id, {
    device: "webgpu",
    dtype: "fp32",
  });
} catch (err) {
  status.textContent = err.message;
  alert(err.message);
  throw err;
}

labelsInput.disabled = false;
templateInput.disabled = false;

status.textContent = "Ready";

// See `model.logit_scale` parameter of original model
const exp_logit_scale = Math.exp(4.6052);

const IMAGE_SIZE = 224;
const canvas = document.createElement("canvas");
canvas.width = canvas.height = IMAGE_SIZE;
const context = canvas.getContext("2d", { willReadFrequently: true });

let isProcessing = false;
let previousTime;
let textEmbeddings;
let prevTextInputs;
let prevTemplate;
let labels;

function onFrameUpdate() {
  if (!isProcessing) {
    isProcessing = true;
    (async function () {
      // If text inputs have changed, update the embeddings
      if (
        prevTextInputs !== labelsInput.value ||
        prevTemplate !== templateInput.value
      ) {
        textEmbeddings = null;
        prevTextInputs = labelsInput.value;
        prevTemplate = templateInput.value;
        labels = prevTextInputs.split(/\s*,\s*/).filter((x) => x);

        if (labels.length > 0) {
          const texts = labels.map((x) =>
            templateInput.value.replaceAll("{}", x),
          );

          const text_inputs = tokenizer(texts, {
            padding: true,
            truncation: true,
          });

          // Compute embeddings
          const { last_hidden_state } = await text_model(text_inputs);
          textEmbeddings = mean_pooling(
            last_hidden_state,
            text_inputs.attention_mask,
          );
          textEmbeddings = layer_norm(textEmbeddings, [textEmbeddings.dims[1]]);
          textEmbeddings = textEmbeddings.normalize(2, -1).tolist();
        } else {
          overlay.innerHTML = "";
        }
      }

      if (textEmbeddings) {
        // Read the current frame from the video
        context.drawImage(video, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
        const pixelData = context.getImageData(
          0,
          0,
          IMAGE_SIZE,
          IMAGE_SIZE,
        ).data;
        const image = new RawImage(pixelData, IMAGE_SIZE, IMAGE_SIZE, 4);

        const image_inputs = await processor(image);

        // Compute embeddings
        const { last_hidden_state } = await vision_model(image_inputs);
        const imageEmbedding = last_hidden_state
          .mean(1)
          .normalize(2, -1)
          .tolist()[0];

        // Compute similarity
        const similarities = textEmbeddings.map(
          (x) => dot(x, imageEmbedding) * exp_logit_scale,
        );

        const sortedIndices = softmax(similarities)
          .map((x, i) => [x, i])
          .sort((a, b) => b[0] - a[0]);

        // Update UI
        overlay.innerHTML = "";
        for (const [score, index] of sortedIndices) {
          overlay.appendChild(
            document.createTextNode(`${labels[index]}: ${score.toFixed(2)}`),
          );
          overlay.appendChild(document.createElement("br"));
        }
      }

      if (previousTime !== undefined) {
        const fps = 1000 / (performance.now() - previousTime);
        status.textContent = `FPS: ${fps.toFixed(2)}`;
      }
      previousTime = performance.now();
      isProcessing = false;
    })();
  }

  window.requestAnimationFrame(onFrameUpdate);
}

// Start the video stream
navigator.mediaDevices
  .getUserMedia(
    { video: true }, // Ask for video
  )
  .then((stream) => {
    // Set up the video and canvas elements.
    video.srcObject = stream;
    video.play();

    const videoTrack = stream.getVideoTracks()[0];
    const { width, height } = videoTrack.getSettings();

    video.width = width;
    video.height = height;

    // Set container width and height depending on the image aspect ratio
    const ar = width / height;
    const [cw, ch] = ar > 720 / 405 ? [720, 720 / ar] : [405 * ar, 405];
    container.style.width = `${cw}px`;
    container.style.height = `${ch}px`;

    // Start the animation loop
    window.requestAnimationFrame(onFrameUpdate);
  })
  .catch((error) => {
    alert(error);
  });
