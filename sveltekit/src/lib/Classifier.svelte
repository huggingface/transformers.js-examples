<script>
  let text = $state("I love Transformers.js!");
  let result = $state(null);

  $effect(() => {
    const params = new URLSearchParams();
    params.append("text", text);
    const url = "/api/classify?" + params.toString();

    fetch(url).then(async (res) => {
      result = await res.json();
    });
  });
</script>

<input
  bind:value={text}
  oninput={(event) => {
    text = event.currentTarget.value;
  }}
  class="w-full rounded border border-gray-300 p-2 dark:bg-black dark:text-white"
/>

<pre
  class="min-h-[120px] w-full rounded border border-gray-300 p-2 dark:bg-black dark:text-white">{result
    ? JSON.stringify(result, null, 2)
    : "Loading…"}</pre>
