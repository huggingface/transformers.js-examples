# Vue Text Summarization Application

This folder contains the source code for a web application that summarizes text using Transformers.js! The app uses the DistilBART-CNN model to generate concise summaries of input text.

## How it works

The user enters text in the input textarea and clicks "Summarize". The application processes the text using the DistilBART-CNN model and displays a summarized version in the output area. The model runs entirely in the browser using WebAssembly and ONNX Runtime.

## Features

- **Text Summarization**: Uses the Xenova/distilbart-cnn-6-6 model for high-quality text summarization
- **Real-time Processing**: Streaming output shows summary generation in real-time
- **Progress Tracking**: Visual progress bars during model loading
- **Responsive UI**: Clean, modern interface built with Vue 3

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Model Information

- **Model**: [Xenova/distilbart-cnn-6-6](https://huggingface.co/Xenova/distilbart-cnn-6-6)
- **Task**: Summarization
- **Framework**: Transformers.js
- **Backend**: ONNX Runtime Web
