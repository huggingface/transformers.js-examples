---
title: Remove Background WebGPU
emoji: 🖼️
colorFrom: purple
colorTo: indigo
sdk: static
pinned: false
license: apache-2.0
models:
  - Xenova/modnet
short_description: In-browser image background removal
thumbnail: https://huggingface.co/spaces/webml-community/remove-background-webgpu/resolve/main/banner.jpg
---

# Remove Background WebGPU

A simple React + Vite application for running [MODNet](https://huggingface.co/Xenova/modnet), a tiny portrait background removal model, locally in the browser using Transformers.js and WebGPU-acceleration.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `remove-background-webgpu` folder:

```sh
cd transformers.js-examples/remove-background-webgpu
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
