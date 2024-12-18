---
title: Moonshine Web
emoji: 🌙
colorFrom: blue
colorTo: pink
sdk: static
pinned: false
license: apache-2.0
models:
  - onnx-community/moonshine-base-ONNX
short_description: Real-time in-browser speech recognition
thumbnail: https://huggingface.co/spaces/webml-community/moonshine-web/resolve/main/banner.png
---

# Moonshine Web

A simple React + Vite application for running [Moonshine Base](https://huggingface.co/onnx-community/moonshine-base-ONNX), a powerful speech-to-text model optimized for fast and accurate automatic speech recognition (ASR) on resource-constrained devices. It runs locally in the browser using Transformers.js and WebGPU-acceleration (or WASM as a fallback).

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `moonshine-web` folder:

```sh
cd transformers.js-examples/moonshine-web
```

### 3. Install Dependencies

Install the necessary dependencies using npm:

```sh
npm i
```

### 4. Run the Development Server

Start the development server:

```sh
npm run dev
```

The application should now be running locally. Open your browser and go to `http://localhost:5173` to see it in action.

## Acknowledgements

The audio visualizer was adapted from Wael Yasmina's [amazing tutorial](https://waelyasmina.net/articles/how-to-create-a-3d-audio-visualizer-using-three-js/).
