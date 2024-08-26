import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";

import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function App() {
  const [images, setImages] = useState([]);
  const [processedImages, setProcessedImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloadReady, setIsDownloadReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const modelRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    (async () => {
      const model_id = "Xenova/modnet";
      env.backends.onnx.wasm.proxy = false;
      modelRef.current ??= await AutoModel.from_pretrained(model_id, {
        device: "webgpu",
      });
      processorRef.current ??= await AutoProcessor.from_pretrained(model_id);
      setIsLoading(false);
    })();
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    setImages((prevImages) => [
      ...prevImages,
      ...acceptedFiles.map((file) => URL.createObjectURL(file)),
    ]);
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

  const removeImage = (index) => {
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
    setProcessedImages((prevProcessed) =>
      prevProcessed.filter((_, i) => i !== index),
    );
  };

  const processImages = async () => {
    setIsProcessing(true);
    setProcessedImages([]);

    const model = modelRef.current;
    const processor = processorRef.current;

    for (let i = 0; i < images.length; ++i) {
      // Load image
      const ri = await RawImage.fromURL(images[i]);

      // Pre-process image
      const { pixel_values } = await processor(ri);

      // Predict alpha matte
      const { output } = await model({ input: pixel_values });

      const maskData = (
        await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
          ri.width,
          ri.height,
        )
      ).data;

      // Create new canvas
      const canvas = document.createElement("canvas");
      canvas.width = ri.width;
      canvas.height = ri.height;
      const ctx = canvas.getContext("2d");

      // Draw original image output to canvas
      ctx.drawImage(ri.toCanvas(), 0, 0);

      // Update alpha channel
      const pixelData = ctx.getImageData(0, 0, ri.width, ri.height);
      for (let i = 0; i < maskData.length; ++i) {
        pixelData.data[4 * i + 3] = maskData[i];
      }
      ctx.putImageData(pixelData, 0, 0);
      setProcessedImages((prevProcessed) => [
        ...prevProcessed,
        canvas.toDataURL("image/png"),
      ]);
    }

    setIsProcessing(false);
    setIsDownloadReady(true);
  };

  const downloadAsZip = async () => {
    const zip = new JSZip();

    for (let i = 0; i < images.length; i++) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = processedImages[i] || images[i];
      await new Promise((resolve) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              zip.file(`image${i + 1}.png`, blob);
            }
            resolve(null);
          }, "image/png");
        };
      });
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "images.zip");
  };

  const clearAll = () => {
    setImages([]);
    setProcessedImages([]);
    setIsDownloadReady(false);
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      console.log("Image URL copied to clipboard");
    });
  };

  const downloadImage = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-4"></div>
          <p className="text-lg">Loading background removal model...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">
          Remove Background WebGPU
        </h1>
        <h2 className="text-lg font-semibold mb-8 text-center">
          In-browser background removal, powered by{" "}
          <a
            className="underline"
            target="_blank"
            href="https://github.com/xenova/transformers.js"
          >
            🤗 Transformers.js
          </a>
        </h2>
        <div
          {...getRootProps()}
          className={`p-8 mb-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-300 ease-in-out
            ${isDragAccept ? "border-green-500 bg-green-900/20" : ""}
            ${isDragReject ? "border-red-500 bg-red-900/20" : ""}
            ${isDragActive ? "border-blue-500 bg-blue-900/20" : "border-gray-700 hover:border-blue-500 hover:bg-blue-900/10"}
          `}
        >
          <input {...getInputProps()} className="hidden" />
          <p className="text-lg mb-2">
            {isDragActive
              ? "Drop the images here..."
              : "Drag and drop some images here"}
          </p>
          <p className="text-sm text-gray-400">or click to select files</p>
        </div>
        <div className="flex flex-col items-center gap-4 mb-8">
          <button
            onClick={processImages}
            disabled={isProcessing || images.length === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200 text-lg font-semibold"
          >
            {isProcessing ? "Processing..." : "Process"}
          </button>
          <div className="flex gap-4">
            <button
              onClick={downloadAsZip}
              disabled={!isDownloadReady}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-black disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200 text-sm"
            >
              Download as ZIP
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black transition-colors duration-200 text-sm"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((src, index) => (
            <div key={index} className="relative group">
              <img
                src={processedImages[index] || src}
                alt={`Image ${index + 1}`}
                className="rounded-lg object-cover w-full h-48"
              />
              <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center">
                <button
                  onClick={() => copyToClipboard(processedImages[index] || src)}
                  className="mx-2 px-3 py-1 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200 text-sm"
                  aria-label={`Copy image ${index + 1} URL to clipboard`}
                >
                  Copy URL
                </button>
                <button
                  onClick={() => downloadImage(processedImages[index] || src)}
                  className="mx-2 px-3 py-1 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200 text-sm"
                  aria-label={`Download image ${index + 1}`}
                >
                  Download
                </button>
              </div>
              <button
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-black bg-opacity-50 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-opacity-70"
                aria-label={`Remove image ${index + 1}`}
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}