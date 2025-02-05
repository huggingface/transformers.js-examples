"use client";

import { useEffect, useState, useRef } from "react";
import { pipeline } from "@huggingface/transformers";

export default function Classifier() {
  const [text, setText] = useState("I love Transformers.js!");
  const [result, setResult] = useState(null);
  const ref = useRef();

  useEffect(() => {
    ref.current ??= pipeline(
      "text-classification",
      "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
    );
  }, []);

  useEffect(() => {
    ref.current.then(async (classifier) => {
      const result = await classifier(text);
      setResult(result[0]);
    });
  }, [text]);

  return (
    <>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="border border-gray-300 rounded p-2 dark:bg-black dark:text-white w-full"
      ></input>

      <pre className="border border-gray-300 rounded p-2 dark:bg-black dark:text-white w-full min-h-[120px]">
        {result ? JSON.stringify(result, null, 2) : "Loading…"}
      </pre>
    </>
  );
}
