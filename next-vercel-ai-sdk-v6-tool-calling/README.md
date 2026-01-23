# Transformers.js and Vercel AI SDK example

A modern Transformers.js chat application powered by [@browser-ai/transformers-js](https://github.com/jakobhoeg/browser-ai) and [Vercel AI SDK v6](https://ai-sdk.dev/).
This app demonstrates how to use Transformers.js models with Vercel AI SDK to quickly build a fully functional AI chat application with tool-calling support.

Components to check out for the implementation:

- [page.tsx](./src/app/page.tsx)
- [chat-transport.tsx](./src/app/chat-transport.ts)
- [store.ts](./src/store/store.ts)
- [models.ts](./src/app/models.ts)

## Features

- Run AI models directly in the browser
- Stream and interrupt responses
- Switch between different Transformers.js models
- Tool calling handling, even for different fine-tuned models
- Human in the Loop (HITL) for approving tool-calls

## Tech Stack

- [Next.js 15](https://nextjs.org)
- [Shadcn/ui](https://ui.shadcn.com) for modern, accessible components
- [Zustand](https://github.com/pmndrs/zustand) for lightweight state management
- **AI Integration**:
  - [Vercel AI SDK](https://ai-sdk.dev/) for chat interface and streaming
  - [@browser-ai/transformers-js](https://github.com/jakobhoeg/browser-ai) model provider that works as a model provider for Transformers.js to integreate with Vercel AI SDK.

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
