---
title: SmolLM WebGPU
emoji: 🤏
colorFrom: blue
colorTo: indigo
sdk: static
pinned: false
license: apache-2.0
models:
  - HuggingFaceTB/SmolLM-360M-Instruct
short_description: A powerful AI chatbot that runs locally in your browser
thumbnail: https://huggingface.co/spaces/webml-community/smollm-webgpu/resolve/main/banner.png
---

# SmolLM WebGPU

A simple React + Vite application for running [SmolLM-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM-360M-Instruct), a powerful small language model, locally in the browser using Transformers.js and WebGPU-acceleration.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `smollm-webgpu` folder:

```sh
cd transformers.js-examples/smollm-webgpu
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
