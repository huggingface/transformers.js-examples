---
title: SvelteKit + Transformers.js Server Template
emoji: 🧩
colorFrom: yellow
colorTo: red
sdk: docker
pinned: false
app_port: 3000
---

# sveltekit

This project, bootstrapped using [`create-svelte`](https://github.com/sveltejs/kit/tree/main/packages/create-svelte), demonstrates how to use `@huggingface/transformers` in [SvelteKit](https://svelte.dev/).

## Instructions

1. Clone the repository:
   ```sh
   git clone https://github.com/huggingface/transformers.js-examples.git
   ```
2. Change directory to the `sveltekit` project:
   ```sh
   cd transformers.js-examples/sveltekit
   ```
3. Install the dependencies:
   ```sh
   npm install
   ```
4. Run the development server:
   ```sh
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

6. You can start editing the page by modifying `src/routes/+page.svelte` (SvelteKit) and `src/routes/api/classify/+server.js` (Transformers.js). The page auto-updates as you edit the file.
