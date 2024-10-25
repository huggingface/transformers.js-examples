<script>
  import Classifier from "$lib/Classifier.svelte";
</script>

<svelte:head>
  <title>Create SvelteKit App</title>
</svelte:head>

<div
  class="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 sm:p-8"
>
  <main class="row-start-2 flex flex-col items-center gap-8 sm:items-start">
    <div class="flex items-center">
      <img src="/hf-logo.svg" alt="Hugging Face logo" width="50" height="50" />
      <span class="mx-5 text-4xl font-light">×</span>
      <img
        class="dark:invert"
        src="/sveltekit.svg"
        alt="SvelteKit logo"
        width="250"
        height="50"
      />
    </div>

    <ol class="list-inside list-decimal text-center text-sm sm:text-left">
      <li class="mb-2">
        Get started by editing
        <code
          class="rounded bg-black/[.05] px-1 py-0.5 font-semibold dark:bg-white/[.06]"
        >
          src/routes/+page.svelte
        </code>.
      </li>
      <li class="mb-2">
        Update Transformers.js code in
        <code
          class="rounded bg-black/[.05] px-1 py-0.5 font-semibold dark:bg-white/[.06]"
        >
          src/routes/api/classify/+server.js
        </code>.
      </li>
      <li>Save and see your changes instantly.</li>
    </ol>

    <div class="flex flex-col items-center gap-4 sm:flex-row">
      <a
        class="flex h-10 items-center justify-center gap-2 rounded-full border border-solid border-transparent bg-foreground px-4 text-sm text-background transition-colors hover:bg-[#383838] sm:h-12 sm:px-5 sm:text-base dark:hover:bg-[#ccc]"
        href="https://github.com/huggingface/transformers.js-examples/tree/main/sveltekit"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source code
      </a>

      <a
        class="flex h-10 items-center justify-center rounded-full border border-solid border-black/[.08] px-4 text-sm transition-colors hover:border-transparent hover:bg-[#f2f2f2] sm:h-12 sm:px-5 sm:text-base dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        href="https://huggingface.co/docs/transformers.js/index"
        target="_blank"
        rel="noopener noreferrer"
      >
        Read our docs
      </a>
    </div>

    <Classifier />
  </main>

  <footer class="row-start-3 flex flex-wrap items-center justify-center gap-6">
    <a
      class="flex items-center gap-2 hover:underline hover:underline-offset-4"
      href="https://github.com/huggingface/transformers.js"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src="/github.svg" alt="GitHub icon" width="16" height="16" />
      Transformers.js
    </a>
    <a
      class="flex items-center gap-2 hover:underline hover:underline-offset-4"
      href="https://github.com/huggingface/transformers.js-examples"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src="/window.svg" alt="Window icon" width="16" height="16" />
      Examples
    </a>
    <a
      class="flex items-center gap-2 hover:underline hover:underline-offset-4"
      href="https://hf.co"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src="/globe.svg" alt="Globe icon" width="16" height="16" />
      Go to hf.co →
    </a>
  </footer>
</div>
