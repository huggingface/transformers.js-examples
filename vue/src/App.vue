<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ProgressBar from './components/ProgressBar.vue'

const PLACEHOLDER_TEXT =
  'The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930.'

const LOADING_MESSAGE = 'Loading models... (only run once)'
const INPUT_ROWS = 6
const OUTPUT_ROWS = 3

const ready = ref(null)
const disabled = ref(false)
const progressItems = ref([])
const input = ref(PLACEHOLDER_TEXT)
const output = ref('')
const worker = ref(null)

onMounted(() => {
  worker.value ??= new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  })

  /**
   * Handles messages received from the Web Worker
   * @param {MessageEvent} event - The message event from the worker
   */
  const onMessageReceived = (event) => {
    switch (event.data.status) {
      case 'initiate':
        ready.value = false
        progressItems.value = [...progressItems.value, event.data]
        break

      case 'progress':
        progressItems.value = progressItems.value.map((item) => {
          if (item.file === event.data.file) {
            return { ...item, progress: event.data.progress }
          }
          return item
        })
        break

      case 'done':
        progressItems.value = progressItems.value.filter((item) => item.file !== event.data.file)
        break

      case 'ready':
        ready.value = true
        break

      case 'update':
        output.value += event.data.output
        break

      case 'complete':
        disabled.value = false
        break
    }
  }

  worker.value.addEventListener('message', onMessageReceived)

  onUnmounted(() => worker.value?.removeEventListener('message', onMessageReceived))
})

const summarize = () => {
  disabled.value = true
  output.value = ''
  worker.value.postMessage({
    text: input.value,
  })
}
</script>

<template>
  <div class="app">
    <h1>Transformers.js</h1>
    <h2>ML-powered text summarization in Vue!</h2>

    <div class="container">
      <div class="textbox-container">
        <textarea
          v-model="input"
          :rows="INPUT_ROWS"
          placeholder="Enter text to summarize..."
        ></textarea>
        <textarea
          :value="output"
          :rows="OUTPUT_ROWS"
          readonly
          placeholder="Summary will appear here..."
        ></textarea>
      </div>
    </div>

    <button :disabled="disabled" @click="summarize">Summarize</button>

    <div class="progress-bars-container">
      <label v-if="ready === false">{{ LOADING_MESSAGE }}</label>
      <div v-for="data in progressItems" :key="data.file">
        <ProgressBar :text="data.file" :percentage="data.progress" />
      </div>
    </div>

    <div class="disclaimer">
      <small
        >⚠️ Disclaimer: AI-generated summaries may be inaccurate or incomplete. Always verify
        important information.</small
      >
    </div>
  </div>
</template>

<style scoped>
.app {
  font-family: Arial, Helvetica, sans-serif;
  max-width: 800px;
  margin: 40px auto;
  padding: 0 20px;
  text-align: center;
}

.container {
  margin: 20px 0;
}

.textbox-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #ccc;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

textarea:focus {
  outline: none;
  border-color: #4caf50;
}

button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:hover:not(:disabled) {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.progress-bars-container {
  margin-top: 20px;
}

.progress-bars-container label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
}

.disclaimer {
  margin-top: 30px;
  text-align: center;
  color: #666;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
</style>
