---
title: Janus Pro WebGPU
emoji: 🏛️
colorFrom: yellow
colorTo: gray
sdk: static
pinned: false
license: apache-2.0
models:
  - onnx-community/Janus-Pro-1B-ONNX
short_description: In-browser unified multimodal understanding and generation.
thumbnail: https://huggingface.co/spaces/webml-community/janus-pro-webgpu/resolve/main/banner.png
---

# Janus Pro 1B WebGPU

A simple React + Vite application for running [Janus-Pro-1B](https://huggingface.co/onnx-community/Janus-Pro-1B-ONNX), a novel autoregressive framework for unified multimodal understanding and generation using Transformers.js and WebGPU-acceleration.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `janus-webgpu` folder:

```sh
cd transformers.js-examples/janus-webgpu
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
