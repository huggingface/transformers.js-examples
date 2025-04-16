import { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

import BotIcon from "./icons/BotIcon";
import BrainIcon from "./icons/BrainIcon";
import UserIcon from "./icons/UserIcon";

import { MathJaxContext, MathJax } from "better-react-mathjax";
import "./Chat.css";

function render(text) {
  // Replace all instances of single backslashes before brackets with double backslashes
  // See https://github.com/markedjs/marked/issues/546 for more information.
  text = text.replace(/\\([\[\]\(\)])/g, "\\\\$1");

  const result = DOMPurify.sanitize(
    marked.parse(text, {
      async: false,
      breaks: true,
    }),
  );
  return result;
}
function Message({ role, content, answerIndex }) {
  const thinking = answerIndex ? content.slice(0, answerIndex) : content;
  const answer = answerIndex ? content.slice(answerIndex) : "";

  const [showThinking, setShowThinking] = useState(false);

  const doneThinking = answer.length > 0;

  return (
    <div className="flex items-start space-x-4">
      {role === "assistant" ? (
        <>
          <BotIcon className="h-6 w-6 min-h-6 min-w-6 my-3 text-gray-500 dark:text-gray-300" />
          <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
            <div className="min-h-6 text-gray-800 dark:text-gray-200 overflow-wrap-anywhere">
              {thinking.length > 0 ? (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg flex flex-col">
                    <button
                      className="flex items-center gap-2 cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg "
                      onClick={() => setShowThinking((prev) => !prev)}
                      style={{ width: showThinking ? "100%" : "auto" }}
                    >
                      <BrainIcon
                        className={doneThinking ? "" : "animate-pulse"}
                      />
                      <span>
                        {doneThinking ? "View reasoning." : "Thinking..."}
                      </span>
                      <span className="ml-auto text-gray-700">
                        {showThinking ? "▲" : "▼"}
                      </span>
                    </button>
                    {showThinking && (
                      <MathJax
                        className="border-t border-gray-200 dark:border-gray-700 px-4 py-2"
                        dynamic
                      >
                        <span
                          className="markdown"
                          dangerouslySetInnerHTML={{
                            __html: render(thinking),
                          }}
                        />
                      </MathJax>
                    )}
                  </div>
                  {doneThinking && (
                    <MathJax className="mt-2" dynamic>
                      <span
                        className="markdown"
                        dangerouslySetInnerHTML={{
                          __html: render(answer),
                        }}
                      />
                    </MathJax>
                  )}
                </>
              ) : (
                <span className="h-6 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-gray-600 dark:bg-gray-300 rounded-full animate-pulse"></span>
                  <span className="w-2.5 h-2.5 bg-gray-600 dark:bg-gray-300 rounded-full animate-pulse animation-delay-200"></span>
                  <span className="w-2.5 h-2.5 bg-gray-600 dark:bg-gray-300 rounded-full animate-pulse animation-delay-400"></span>
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <UserIcon className="h-6 w-6 min-h-6 min-w-6 my-3 text-gray-500 dark:text-gray-300" />
          <div className="bg-blue-500 text-white rounded-lg p-4">
            <p className="min-h-6 overflow-wrap-anywhere">{content}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function Chat({ messages }) {
  const empty = messages.length === 0;

  return (
    <div
      className={`flex-1 p-6 max-w-[960px] w-full ${empty ? "flex flex-col items-center justify-end" : "space-y-4"}`}
    >
      <MathJaxContext>
        {empty ? (
          <div className="text-xl">Ready!</div>
        ) : (
          messages.map((msg, i) => <Message key={`message-${i}`} {...msg} />)
        )}
      </MathJaxContext>
    </div>
  );
}
