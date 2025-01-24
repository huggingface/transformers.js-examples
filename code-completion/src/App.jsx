import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import Progress from "./components/Progress";

const MODELS = [
  "onnx-community/Qwen2.5-Coder-0.5B-ONNX",
  "Xenova/tiny_starcoder_py",
  "Xenova/codegen-350M-mono",
  // 'Xenova/starcoderbase-1b',
];
function App() {
  // Editor setup
  const monaco = useRef(null);
  const [monacoReady, setMonacoReady] = useState(false);
  const [language, setLanguage] = useState("python"); // Only allow python for now

  // Model loading
  const [ready, setReady] = useState(null);
  const [progressItems, setProgressItems] = useState([]);

  // Inputs and outputs
  const [model, setModel] = useState(MODELS[0]);
  const [maxNewTokens, setMaxNewTokens] = useState(42);
  const [code, setCode] = useState(
    '\ndef fib(n):\n    """Calculates the nth Fibonacci number"""\n',
  );

  // Generation parameters
  const [temperature, setTemperature] = useState(0.5);
  const [topK, setTopK] = useState(5);
  const [doSample, setDoSample] = useState(false);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case "initiate":
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data };
              }
              return item;
            }),
          );
          break;

        case "done":
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file),
          );
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;

        case "update":
          // Generation update: update the output text.
          setCode((prev) => prev + e.data.output);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  });

  useEffect(() => {
    const m = monaco.current;
    if (!m) return;

    let actionRegistration = m.addAction({
      id: "generate",
      label: "Generate",
      contextMenuGroupId: "0_custom",
      run: () => {
        const val = m.getValue();
        if (!val) return;

        worker.current.postMessage({
          model,
          text: val,
          max_new_tokens: maxNewTokens,
          temperature,
          top_k: topK,
          do_sample: doSample,
        });
      },
    });

    // Define a cleanup function for when the component is unmounted.
    return () => actionRegistration.dispose();
  }, [monacoReady, model, maxNewTokens, temperature, topK, doSample]);

  const showLoading = ready === false || progressItems.length > 0;

  return (
    <div className="flex h-screen w-screen">
      <div
        className={`gap-1 z-50 top-0 left-0 absolute w-full h-full transition-all px-8 flex flex-col justify-center text-center bg-black bg-opacity-50 backdrop-blur-sm ${
          showLoading
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {ready === false && (
          <label className="text-3xl p-3 text-white">Loading model...</label>
        )}
        {progressItems.map((data) => (
          <div key={data.file}>
            <Progress data={data} />
          </div>
        ))}
      </div>
      <div>
        <Editor
          width="calc(100vw - 360px)"
          language={language}
          value={code}
          onChange={(value) => setCode(value)}
          theme="vs-dark"
          onMount={(m) => {
            monaco.current = m;
            setMonacoReady(true);
          }}
          options={{
            fontSize: 24,
          }}
        />
      </div>
      <div className="flex-grow bg-gray-900 text-white p-4 flex flex-col overflow-y-auto">
        <h2 className="text-2xl font-semibold text-center mb-2">
          In-browser code completion
        </h2>
        <div className="text-center">
          Made with&nbsp;
          <a
            className="text-blue-400 underline"
            href="https://github.com/huggingface/transformers.js"
            target="_blank"
            rel="noreferrer"
          >
            🤗 Transformers.js
          </a>
        </div>

        <label className="mt-3">Instructions:</label>
        <ol className="list-decimal	list-outside pl-4">
          <li>
            Choose a model from the dropdown and modify the generation settings
          </li>
          <li>Write some code in the editor</li>
          <li>Right-click and select "Generate"</li>
        </ol>

        <label className="mt-3">Model:</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="p-2.5 bg-gray-800 border border-gray-700 text-gray-100 rounded-lg"
        >
          {MODELS.map((value, i) => {
            return (
              <option key={i} value={value}>
                {value}
              </option>
            );
          })}
        </select>

        <div className="mt-3 flex justify-between">
          <label>Max new tokens:</label>
          <label>{maxNewTokens}</label>
        </div>
        <input
          type="range"
          min="1"
          max="512"
          value={maxNewTokens}
          onChange={(event) => {
            const newValue = parseInt(event.target.value);
            setMaxNewTokens(newValue);
          }}
          className="w-full"
        />

        <div className="mt-3 flex items-center">
          <input
            id="default-checkbox"
            type="checkbox"
            value={doSample}
            onInput={(event) => {
              setDoSample(event.target.checked);
            }}
            className="w-4 h-4 text-blue-600 rounded focus:ring focus:ring-blue-600 bg-gray-800 border-gray-700"
          />
          <label htmlFor="default-checkbox" className="ml-2 font-medium">
            Sample
          </label>
        </div>

        <div
          className={`mt-3 flex justify-between ${
            doSample ? "opacity-100" : "opacity-50"
          }`}
        >
          <label>Top K:</label>
          <label>{topK}</label>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={topK}
          onChange={(e) => setTopK(parseInt(e.target.value))}
          disabled={!doSample}
          className="w-full"
        />

        <div
          className={`mt-3 flex justify-between ${
            doSample ? "opacity-100" : "opacity-50"
          }`}
        >
          <label>Temperature:</label>
          <label>{temperature}</label>
        </div>
        <input
          type="range"
          min="0"
          step="0.05"
          max="1"
          value={temperature}
          onChange={(event) => {
            const newValue = Number(event.target.value);
            setTemperature(newValue);
          }}
          disabled={!doSample}
          className="w-full"
        />
        <div className="flex gap-2 justify-center mt-auto">
          <svg
            className="w-6 h-6 text-white"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 .333A9.911 9.911 0 0 0 6.866 19.65c.5.092.678-.215.678-.477 0-.237-.01-1.017-.014-1.845-2.757.6-3.338-1.169-3.338-1.169a2.627 2.627 0 0 0-1.1-1.451c-.9-.615.07-.6.07-.6a2.084 2.084 0 0 1 1.518 1.021 2.11 2.11 0 0 0 2.884.823c.044-.503.268-.973.63-1.325-2.2-.25-4.516-1.1-4.516-4.9A3.832 3.832 0 0 1 4.7 7.068a3.56 3.56 0 0 1 .095-2.623s.832-.266 2.726 1.016a9.409 9.409 0 0 1 4.962 0c1.89-1.282 2.717-1.016 2.717-1.016.366.83.402 1.768.1 2.623a3.827 3.827 0 0 1 1.02 2.659c0 3.807-2.319 4.644-4.525 4.889a2.366 2.366 0 0 1 .673 1.834c0 1.326-.012 2.394-.012 2.72 0 .263.18.572.681.475A9.911 9.911 0 0 0 10 .333Z"
              clipRule="evenodd"
            />
          </svg>

          <a
            className="text-white font-normal underline underline-offset-1"
            href="https://github.com/huggingface/transformers.js-examples/tree/main/code-completion"
            target="_blank"
            rel="noreferrer"
          >
            Source code
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
