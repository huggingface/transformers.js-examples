---
title: Vue Text Summarization
emoji: 📝
colorFrom: green
colorTo: blue
sdk: static
pinned: false
license: apache-2.0
models:
  - Xenova/distilbart-cnn-6-6
short_description: Text summarization using Transformers.js in Vue.js
---

# Vue Text Summarization Application

This folder contains the source code for a web application that summarizes text using Transformers.js! The app uses the DistilBART-CNN model to generate concise summaries of input text.

## Getting Started

Follow the steps below to set up and run the application.

### 1. Clone the Repository

Clone the examples repository from GitHub:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
```

### 2. Navigate to the Project Directory

Change your working directory to the `vue` folder:

```sh
cd transformers.js-examples/vue
```

### 3. Install Dependencies

Install the necessary dependencies using npm:

```sh
npm install
```

### 4. Run the Development Server

Start the development server:

```sh
npm run dev
```

The application should now be running locally. Open your browser and go to `http://localhost:5173` to see it in action.

## How it works

The user enters text in the input textarea and clicks "Summarize". The application processes the text using the DistilBART-CNN model and displays a summarized version in the output area. The model runs entirely in the browser using WebAssembly and ONNX Runtime.

## Features

- **Text Summarization**: Uses the Xenova/distilbart-cnn-6-6 model for high-quality text summarization
- **Real-time Processing**: Streaming output shows summary generation in real-time
- **Progress Tracking**: Visual progress bars during model loading
- **Responsive UI**: Clean, modern interface built with Vue 3

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar).

## Model Information

- **Model**: [Xenova/distilbart-cnn-6-6](https://huggingface.co/Xenova/distilbart-cnn-6-6)
- **Task**: Summarization
- **Framework**: Transformers.js
- **Backend**: ONNX Runtime Web
