---
title: Gemma 2 JPN WebGPU
emoji: 🤖
colorFrom: green
colorTo: pink
sdk: static
pinned: false
license: apache-2.0
models:
  - onnx-community/gemma-2-2b-jpn-it
short_description: Gemma-2-JPN running locally in your browser on WebGPU
thumbnail: https://huggingface.co/spaces/webml-community/gemma-2-2b-jpn-webgpu/resolve/main/banner.png
---

# Gemma 2 JPN WebGPU

A simple React + Vite application for running [gemma-2-2b-jpn-it](onnx-community/gemma-2-2b-jpn-it), a powerful small language model, locally in the browser using Transformers.js and WebGPU-acceleration.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `gemma-2-2b-jpn-webgpu` folder:

```sh
cd transformers.js-examples/gemma-2-2b-jpn-webgpu
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
