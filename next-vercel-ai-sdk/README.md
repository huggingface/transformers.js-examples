# Transformers.js and Vercel AI SDK example

A modern Transformers.js chat application powered by [@built-in-ai/transformers-js](https://github.com/jakobhoeg/built-in-ai) and [Vercel AI SDK](https://ai-sdk.dev/). 
This app demonstrates how to use Transformers.js models with Vercel AI SDK to quickly build a fully functional chat application.

## Features

- Run AI models directly in the browser
- Stream and interrupt responses
- Switch between different Transformers.js models
- Upload and process images in conversations
- Render reasoning for reasoning models (Qwen3)

## Tech Stack

- [Next.js 15](https://nextjs.org)
- [Shadcn/ui](https://ui.shadcn.com) for modern, accessible components
- [Zustand](https://github.com/pmndrs/zustand) for lightweight state management
- **AI Integration**: 
  - [Vercel AI SDK](https://ai-sdk.dev/) for chat interface and streaming
  - [@built-in-ai/transformers-js](https://github.com/jakobhoeg/built-in-ai) model provider that works as a wrapper for Transformers.js to integreate with Vercel AI SDK. 

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/huggingface/transformers.js-examples/tree/main/next-vercel-ai-sdk)