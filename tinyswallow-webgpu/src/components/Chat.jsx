import { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

import BotIcon from "./icons/BotIcon";
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
function Message({ role, content }) {
  return (
    <div className="flex items-start space-x-4">
      {role === "assistant" ? (
        <>
          <BotIcon className="h-6 w-6 min-h-6 min-w-6 my-3 text-gray-500 dark:text-gray-300" />
          <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
            <div className="min-h-6 text-gray-800 dark:text-gray-200 overflow-wrap-anywhere">
              {content.length > 0 ? (
                <MathJax className="mt-2" dynamic>
                  <span
                    className="markdown"
                    dangerouslySetInnerHTML={{
                      __html: render(content),
                    }}
                  />
                </MathJax>
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
