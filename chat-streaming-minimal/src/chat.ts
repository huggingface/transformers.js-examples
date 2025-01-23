// Chat history array with role-based messages
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function setupChat() {
  // chat.ts
  // Main entry for the chat application. Manages UI, chat history, and communicates with the worker.

  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  })

  let chatHistory: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Hello, I am your assistant. How can I help you today?',
    },
  ]

  // Convert chat history into a prompt
  function createPrompt(messages: ChatMessage[]): string {
    let prompt = ''
    for (const msg of messages)
      if (msg.role === 'assistant') prompt += `# Bot: ${msg.content}\n`
      else prompt += `# User: ${msg.content}\n`

    // The assistant's answer should follow
    prompt += '# Bot:'
    return prompt
  }

  // QWEN 0.5B is takes a longer time to generate
  // function createQwenPrompt(messages: ChatMessage[]): string {
  //   let prompt = ''
  //   prompt += `<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n`

  //   for (const msg of messages)
  //     if (msg.role === 'assistant')
  //       prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`
  //     else if (msg.role === 'user')
  //       prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`

  //   // Add the assistant's answer prompt
  //   prompt += `<|im_start|>assistant\n`
  //   return prompt
  // }

  // Grabs DOM elements for the UI
  const app = document.querySelector<HTMLDivElement>('#app')!

  app.innerHTML = `
  <div class="flex flex-col h-screen bg-gray-50">
    <header class="bg-white shadow p-4">
      <h1 class="text-slate-700 text-2xl font-bold text-center">
        Transformers.js Chat (Streaming via Web Worker)
      </h1>
    </header>

    <main class="flex-1 p-4 overflow-y-auto">
      <div id="messages" class="space-y-4"></div>
    </main>

    <footer class="bg-white p-4">
      <!-- Loading indicator -->
      <div id="loading-container" class="mb-2 hidden">
        <div id="progress-bar" class="h-2 bg-blue-500 w-0"></div>
        <span id="progress-text" class="text-sm text-gray-500"></span>
      </div>

      <form id="chat-form" class="flex space-x-2">
        <input
          type="text"
          id="user-input"
          class="flex-1 border text-black border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message..."
          required
        />
        <button
          id="send-button"
          type="submit"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </footer>
  </div>
`

  const form = document.getElementById('chat-form') as HTMLFormElement
  const userInput = document.getElementById('user-input') as HTMLInputElement
  const messagesContainer = document.getElementById(
    'messages'
  ) as HTMLDivElement
  const sendButton = document.getElementById('send-button') as HTMLButtonElement
  const loadingContainer = document.getElementById(
    'loading-container'
  ) as HTMLDivElement
  const progressBar = document.getElementById('progress-bar') as HTMLDivElement
  const progressText = document.getElementById(
    'progress-text'
  ) as HTMLSpanElement
  const typeIndicator = '⏺' // ⏺ or ⬤ or ●

  // Display initial assistant message (if any)
  renderChatMessages(chatHistory)

  // Listen for messages from the worker
  worker.addEventListener('message', (event) => {
    const data = event.data
    if (data.status === 'debug') console.debug(data)

    // Handle progress status
    if (data.status === 'initiate') {
      loadingContainer.classList.remove('hidden')
      progressText.textContent = `Loading ${data.file}...`
      return
    }

    if (data.status === 'progress') {
      const percentage = Math.round(data.progress)
      progressBar.style.width = `${percentage}%`
      progressText.textContent = `Loading ${data.file}: ${percentage}%`
      return
    }

    if (data.status === 'done') {
      if (data.file.includes('onnx')) {
        progressBar.style.width = '100%'
        sendButton.disabled = false
        loadingContainer.classList.add('hidden')
        return
      }
    }

    // Streaming updates
    if (data.status === 'update') {
      // Update the last assistant message in the UI with partial text
      updateLastAssistantMessage(data.output)
      return
    }

    // Completed generation
    if (data.status === 'complete') {
      const allMessages = messagesContainer.querySelectorAll('p')
      const lastMessage = allMessages[allMessages.length - 1]
      const message = (lastMessage.textContent as string).slice(0, -1)
      lastMessage.textContent = message
      chatHistory[chatHistory.length - 1].content = message
      sendButton.disabled = false
      return
    }
  })

  // On first load, disable the Send button until the model is loaded
  sendButton.disabled = true
  // Post the prompt to the worker
  worker.postMessage({
    type: 'init',
  })

  // Form submit event
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const query = userInput.value.trim()
    if (!query) return
    sendButton.disabled = true

    // Add user message to chat history
    chatHistory.push({ role: 'user', content: query })

    // Render user's message
    appendMessage('User', query)

    // Prepare an empty assistant response placeholder
    chatHistory.push({ role: 'assistant', content: '' })
    appendMessage('Bot', typeIndicator)

    // Create final prompt
    const prompt = createPrompt(chatHistory)

    // Post the prompt to the worker
    worker.postMessage({
      type: 'generate',
      prompt,
      max_new_tokens: 20,
    })

    // Clear the user input
    userInput.value = ''
  })

  // Renders the entire chat (used initially to display existing messages)
  function renderChatMessages(messages: ChatMessage[]) {
    messagesContainer.innerHTML = ''
    for (const msg of messages) {
      appendMessage(msg.role === 'user' ? 'User' : 'Bot', msg.content)
    }
  }

  // Appends a single message to the UI
  function appendMessage(sender: 'User' | 'Bot', text: string): void {
    const messageWrapper = document.createElement('div')
    messageWrapper.classList.add('flex', 'flex-col', 'mb-2')

    const senderElement = document.createElement('span')
    senderElement.classList.add(
      'text-sm',
      'font-semibold',
      sender === 'User' ? 'text-blue-500' : 'text-green-500'
    )
    senderElement.textContent = sender

    const textElement = document.createElement('p')
    textElement.classList.add(
      'mt-1',
      'bg-white',
      'p-3',
      'rounded-lg',
      'shadow',
      'text-gray-700',
      'max-w-md'
    )
    textElement.textContent = text

    // Right-align user, left-align bot
    if (sender === 'User') {
      senderElement.classList.add('self-end')
      textElement.classList.add('self-end')
    } else {
      senderElement.classList.add('self-start')

      textElement.classList.add('self-start')
    }

    messageWrapper.appendChild(senderElement)
    messageWrapper.appendChild(textElement)
    messagesContainer.appendChild(messageWrapper)

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  // Updates only the last assistant message in the UI
  function updateLastAssistantMessage(newText: string): void {
    const allMessages = messagesContainer.querySelectorAll('p')
    if (allMessages.length > 0) {
      const lastMessage = allMessages[allMessages.length - 1]
      lastMessage.textContent = lastMessage.textContent?.slice(0, -1) || ''
      lastMessage.textContent += newText
      lastMessage.textContent += typeIndicator
    }
  }
}
