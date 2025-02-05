import { useEffect, useState, useRef } from "react";

import Chat from "./components/Chat";
import ArrowRightIcon from "./components/icons/ArrowRightIcon";
import StopIcon from "./components/icons/StopIcon";
import Progress from "./components/Progress";
import ImageIcon from "./components/icons/ImageIcon";
import ImagePreview from "./components/ImagePreview";

const IS_WEBGPU_AVAILABLE = !!navigator.gpu;
const STICKY_SCROLL_THRESHOLD = 120;
const EXAMPLES = [
  {
    display: "Generate an image of a cute baby fox.",
    prompt:
      "/imagine A cute and adorable baby fox with big brown eyes, autumn leaves in the background enchanting, immortal, fluffy, shiny mane, Petals, fairyism, unreal engine 5 and Octane Render, highly detailed, photorealistic, cinematic, natural colors.",
  },
  {
    prompt: "Convert the formula into latex code.",
    image:
      "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/quadratic_formula.png",
  },
  {
    prompt: "What is the difference between AI and ML?",
  },
  {
    prompt: "Write python code to compute the nth fibonacci number.",
  },
];

function App() {
  // Create a reference to the worker object.
  const worker = useRef(null);

  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const imageUploadRef = useRef(null);

  // Model loading and progress
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progressItems, setProgressItems] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Inputs and outputs
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tps, setTps] = useState(null);
  const [numTokens, setNumTokens] = useState(null);
  const [imageProgress, setImageProgress] = useState(null);
  const [imageGenerationTime, setImageGenerationTime] = useState(null);

  function onEnter(message, img) {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, image: img ?? image },
    ]);
    setTps(null);
    setIsRunning(true);
    setInput("");
    setImage(null);
    setNumTokens(null);
    setImageProgress(null);
    setImageGenerationTime(null);
  }

  function onInterrupt() {
    // NOTE: We do not set isRunning to false here because the worker
    // will send a 'complete' message when it is done.
    worker.current.postMessage({ type: "interrupt" });
  }

  function resizeInput() {
    if (!textareaRef.current) return;

    const target = textareaRef.current;
    target.style.height = "auto";
    const newHeight = Math.min(Math.max(target.scrollHeight, 24), 200);
    target.style.height = `${newHeight}px`;
  }

  useEffect(() => {
    resizeInput();
  }, [input]);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    // Create the worker if it does not yet exist.
    if (!worker.current) {
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
      worker.current.postMessage({ type: "check" }); // Do a feature check
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        // WebGPU feature checking
        case "success":
          setStatus("idle");
          break;
        case "error":
          setError(e.data.data);
          break;

        case "loading":
          // Model file start load: add a new progress item to the list.
          setStatus("loading");
          setLoadingMessage(e.data.data);
          break;

        case "initiate":
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
          setStatus("ready");
          break;

        case "start":
          {
            // Start generation
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "" },
            ]);
          }
          break;

        case "text-update":
          // Generation update: update the output text.
          // Parse messages
          const { output, tps, numTokens } = e.data;
          setTps(tps);
          setNumTokens(numTokens);
          setMessages((prev) => {
            const cloned = [...prev];
            const last = cloned.at(-1);
            cloned[cloned.length - 1] = {
              ...last,
              content: last.content + output,
            };
            return cloned;
          });
          break;

        case "image-update":
          const { blob, progress, time } = e.data;

          if (blob) {
            // Add image to the last message
            const url = URL.createObjectURL(blob);
            setMessages((prev) => {
              const cloned = [...prev];
              const last = cloned.at(-1);
              cloned[cloned.length - 1] = {
                ...last,
                image: url,
              };
              return cloned;
            });
          } else {
            setImageProgress(progress);
            setImageGenerationTime(time);
          }
          break;

        case "complete":
          // Generation complete: re-enable the "Generate" button
          setIsRunning(false);
          break;
      }
    };

    const onErrorReceived = (e) => {
      console.error("Worker error:", e);
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);
    worker.current.addEventListener("error", onErrorReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current.removeEventListener("message", onMessageReceived);
      worker.current.removeEventListener("error", onErrorReceived);
    };
  }, []);

  // Send the messages to the worker thread whenever the `messages` state changes.
  useEffect(() => {
    if (messages.filter((x) => x.role === "user").length === 0) {
      // No user messages yet: do nothing.
      return;
    }
    if (messages.at(-1).role === "assistant") {
      // Do not update if the last message is from the assistant
      return;
    }
    setTps(null);
    worker.current.postMessage({ type: "generate", data: messages });
  }, [messages, isRunning]);

  useEffect(() => {
    if (!chatContainerRef.current || !isRunning) return;
    const element = chatContainerRef.current;
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICKY_SCROLL_THRESHOLD
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isRunning]);

  return IS_WEBGPU_AVAILABLE ? (
    <div className="flex flex-col h-screen mx-auto items justify-end text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900">
      {(status === null || status === "idle") && messages.length === 0 && (
        <div className="h-full overflow-auto scrollbar-thin flex justify-center items-center flex-col relative">
          <div className="flex flex-col items-center mb-1 max-w-[436px] text-center">
            <img
              src="logo.png"
              width="70%"
              height="auto"
              className="block"
            ></img>
            <h1 className="text-5xl font-bold mb-1">Janus Pro WebGPU</h1>
            <h2 className="font-semibold">
              A novel autoregressive framework for unified
              <br />
              multimodal understanding and generation.
            </h2>
          </div>

          <div className="flex flex-col items-center px-4">
            <p className="max-w-[470px] mb-4">
              <br />
              You are about to load{" "}
              <a
                href="https://huggingface.co/onnx-community/Janus-Pro-1B-ONNX"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Janus-Pro-1B
              </a>
              , a multimodal vision-language model that is optimized for
              inference on the web. Everything runs 100% locally in your browser
              with{" "}
              <a
                href="https://huggingface.co/docs/transformers.js"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                🤗&nbsp;Transformers.js
              </a>{" "}
              and ONNX Runtime Web, meaning no data is sent to a server. Once
              the model has loaded, it can even be used offline. The source code
              for the demo can be found on{" "}
              <a
                href="https://github.com/huggingface/transformers.js-examples/tree/main/janus-pro-webgpu"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                GitHub
              </a>
              .
            </p>

            {error && (
              <div className="text-red-500 text-center mb-2">
                <p className="mb-1">
                  Unable to load model due to the following error:
                </p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!error && (
              <button
                className="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none"
                onClick={() => {
                  worker.current.postMessage({ type: "load" });
                  setStatus("loading");
                }}
                disabled={status === null || status === "loading"}
              >
                {status === null ? "Running feature checks..." : "Load model"}
              </button>
            )}
          </div>
        </div>
      )}
      {status === "loading" && (
        <>
          <div className="w-full max-w-[500px] text-left mx-auto p-4 bottom-0 mt-auto">
            <p className="text-center mb-1">{loadingMessage}</p>
            {progressItems.map(({ file, progress, total }, i) => (
              <Progress
                key={i}
                text={file}
                percentage={progress}
                total={total}
              />
            ))}
          </div>
        </>
      )}

      {status === "ready" && (
        <div
          ref={chatContainerRef}
          className="overflow-y-auto scrollbar-thin w-full flex flex-col items-center h-full"
        >
          <Chat messages={messages} />
          {messages.length === 0 && !image && (
            <div className="flex flex-col center">
              {EXAMPLES.map(({ display, prompt, image }, i) => (
                <div
                  key={i}
                  className="max-w-[600px] m-1 border dark:border-gray-600 rounded-md p-2 bg-gray-100 dark:bg-gray-700 cursor-pointer"
                  onClick={() => onEnter(prompt, image)}
                >
                  {display ?? prompt}
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-sm min-h-6 text-gray-500 dark:text-gray-300">
            {messages.length > 0 && (
              <>
                {tps ? (
                  <>
                    {!isRunning && (
                      <span>
                        Generated {numTokens} tokens in{" "}
                        {(numTokens / tps).toFixed(2)} seconds&nbsp;&#40;
                      </span>
                    )}
                    <span className="font-medium font-mono text-center mr-1 text-black dark:text-white">
                      {tps.toFixed(2)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-300">
                      tokens/second
                    </span>
                    {!isRunning && <span className="mr-1">&#41;.</span>}
                  </>
                ) : (
                  imageProgress && (
                    <>
                      {isRunning ? (
                        <>
                          <span>Generating image...</span>&nbsp;&#40;
                          <span className="font-medium font-mono text-center text-black dark:text-white">
                            {(imageProgress * 100).toFixed(2)}%
                          </span>
                          <span className="mr-1">&#41;</span>
                        </>
                      ) : (
                        <span>
                          Generated image in{" "}
                          {(imageGenerationTime / 1000).toFixed(2)}{" "}
                          seconds.&nbsp;
                        </span>
                      )}
                    </>
                  )
                )}

                {!isRunning && (
                  <span
                    className="underline cursor-pointer"
                    onClick={() => setMessages([])}
                  >
                    Reset
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-2 border dark:bg-gray-700 rounded-lg w-[600px] max-w-[80%] max-h-[200px] mx-auto relative mb-3 flex">
        <label
          htmlFor="file-upload"
          className={
            status === "ready"
              ? "cursor-pointer"
              : "cursor-not-allowed pointer-events-none"
          }
        >
          <ImageIcon
            className={`h-8 w-8 p-1 rounded-md ${status === "ready" ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"} absolute bottom-3 left-1.5`}
          ></ImageIcon>
          <input
            ref={imageUploadRef}
            id="file-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onInput={(e) => {
              const file = e.target.files[0];
              if (!file) {
                return;
              }

              const reader = new FileReader();

              // Set up a callback when the file is loaded
              reader.onload = (e2) => {
                setImage(e2.target.result);
                e.target.value = "";
              };

              reader.readAsDataURL(file);
            }}
          ></input>
        </label>
        <div className="w-full flex flex-col">
          {image && (
            <ImagePreview
              onRemove={() => {
                setImage(null);
              }}
              src={image}
              className="w-20 h-20 min-w-20 min-h-20 relative p-2"
            />
          )}

          <textarea
            ref={textareaRef}
            className="scrollbar-thin w-full pl-11 pr-12 dark:bg-gray-700 py-4 rounded-lg bg-transparent border-none outline-none text-gray-800 disabled:text-gray-400 dark:text-gray-100 placeholder-gray-500 disabled:placeholder-gray-200 dark:placeholder-gray-300 dark:disabled:placeholder-gray-500 resize-none disabled:cursor-not-allowed"
            placeholder="Type message or use '/imagine <prompt>' to generate an image."
            type="text"
            rows={1}
            value={input}
            disabled={status !== "ready"}
            title={
              status === "ready" ? "Model is ready" : "Model not loaded yet"
            }
            onKeyDown={(e) => {
              if (
                input.length > 0 &&
                !isRunning &&
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault(); // Prevent default behavior of Enter key
                onEnter(input, image);
              }
            }}
            onInput={(e) => setInput(e.target.value)}
          />
        </div>
        {isRunning ? (
          <div className="cursor-pointer" onClick={onInterrupt}>
            <StopIcon className="h-8 w-8 p-1 rounded-md text-gray-800 dark:text-gray-100 absolute right-3 bottom-3" />
          </div>
        ) : input.length > 0 ? (
          <div className="cursor-pointer" onClick={() => onEnter(input)}>
            <ArrowRightIcon
              className={`h-8 w-8 p-1 bg-gray-800 dark:bg-gray-100 text-white dark:text-black rounded-md absolute right-3 bottom-3`}
            />
          </div>
        ) : (
          <div>
            <ArrowRightIcon
              className={`h-8 w-8 p-1 bg-gray-200 dark:bg-gray-600 text-gray-50 dark:text-gray-800 rounded-md absolute right-3 bottom-3`}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center mb-3">
        Disclaimer: Generated content may be inaccurate or false.
      </p>
    </div>
  ) : (
    <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
      WebGPU is not supported
      <br />
      by this browser :&#40;
    </div>
  );
}

export default App;
