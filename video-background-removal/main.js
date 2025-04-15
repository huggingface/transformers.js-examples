import { pipeline, RawImage } from "@huggingface/transformers";

// Reference the elements that we will need
const status = document.getElementById("status");
const container = document.getElementById("container");
const canvas = document.getElementById("canvas");
const outputCanvas = document.getElementById("output-canvas");
const video = document.getElementById("video");
const sizeSlider = document.getElementById("size");
const sizeLabel = document.getElementById("size-value");
const scaleSlider = document.getElementById("scale");
const scaleLabel = document.getElementById("scale-value");

function setStreamSize(width, height) {
  video.width = outputCanvas.width = canvas.width = Math.round(width);
  video.height = outputCanvas.height = canvas.height = Math.round(height);
}

status.textContent = "Loading model...";

// Load model and processor
const model_id = "Xenova/modnet";
let pipe;
try {
  pipe = await pipeline("background-removal", model_id, {
    device: "webgpu",
    dtype: "fp32", // TODO: add fp16 support
  });
} catch (err) {
  status.textContent = err.message;
  alert(err.message);
  throw err;
}

// Set up controls
let size = 256;
pipe.processor.feature_extractor.size = { shortest_edge: size };
sizeSlider.addEventListener("input", () => {
  size = Number(sizeSlider.value);
  pipe.processor.feature_extractor.size = { shortest_edge: size };
  sizeLabel.textContent = size;
});
sizeSlider.disabled = false;

let scale = 0.5;
scaleSlider.addEventListener("input", () => {
  scale = Number(scaleSlider.value);
  setStreamSize(video.videoWidth * scale, video.videoHeight * scale);
  scaleLabel.textContent = scale;
});
scaleSlider.disabled = false;

status.textContent = "Ready";

let isProcessing = false;
let previousTime;
const context = canvas.getContext("2d", { willReadFrequently: true });
const outputContext = outputCanvas.getContext("2d", {
  willReadFrequently: true,
});
function updateCanvas() {
  const { width, height } = canvas;

  if (!isProcessing) {
    isProcessing = true;
    (async function () {
      // Read the current frame from the video
      context.drawImage(video, 0, 0, width, height);
      const currentFrame = context.getImageData(0, 0, width, height);
      const image = new RawImage(currentFrame.data, width, height, 4);

      // Predict alpha matte
      const [output] = await pipe(image);

      // Draw the alpha matte on the canvas
      outputContext.putImageData(
        new ImageData(output.data, output.width, output.height),
        0,
        0,
      );

      if (previousTime !== undefined) {
        const fps = 1000 / (performance.now() - previousTime);
        status.textContent = `FPS: ${fps.toFixed(2)}`;
      }
      previousTime = performance.now();

      isProcessing = false;
    })();
  }

  window.requestAnimationFrame(updateCanvas);
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

    setStreamSize(width * scale, height * scale);

    // Set container width and height depending on the image aspect ratio
    const ar = width / height;
    const [cw, ch] = ar > 720 / 405 ? [720, 720 / ar] : [405 * ar, 405];
    container.style.width = `${cw}px`;
    container.style.height = `${ch}px`;

    // Start the animation loop
    setTimeout(updateCanvas, 50);
  })
  .catch((error) => {
    alert(error);
  });
