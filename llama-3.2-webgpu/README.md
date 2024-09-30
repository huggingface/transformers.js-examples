---
title: Llama 3.2 WebGPU
emoji: 🦙
colorFrom: green
colorTo: pink
sdk: static
pinned: false
license: apache-2.0
models:
  - onnx-community/Llama-3.2-1B-Instruct-q4f16
short_description: A powerful AI chatbot that runs locally in your browser
thumbnail: https://huggingface.co/spaces/webml-community/llama-3.2-webgpu/resolve/main/banner.png
---

# Llama-3.2 WebGPU

A simple React + Vite application for running [Llama-3.2-1B-Instruct](https://huggingface.co/onnx-community/Llama-3.2-1B-Instruct-q4f16), a powerful small language model, locally in the browser using Transformers.js and WebGPU-acceleration.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `llama-3.2-webgpu` folder:

```sh
cd transformers.js-examples/llama-3.2-webgpu
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
