---
title: Phi-3.5 WebGPU
emoji: ⚡
colorFrom: yellow
colorTo: red
sdk: static
pinned: false
license: apache-2.0
models:
  - onnx-community/Phi-3.5-mini-instruct-onnx-web
short_description: A powerful AI chatbot that runs locally in your browser
thumbnail: https://huggingface.co/spaces/webml-community/phi-3.5-webgpu/resolve/main/banner.png
---

# Phi-3.5 WebGPU

A simple React + Vite application for running [Phi-3.5-mini-instruct](https://huggingface.co/onnx-community/Phi-3.5-mini-instruct-onnx-web), a powerful small language model, locally in the browser using Transformers.js and WebGPU-acceleration.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `phi-3.5-webgpu` folder:

```sh
cd transformers.js-examples/phi-3.5-webgpu
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
