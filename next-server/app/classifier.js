"use client";

import { useEffect, useState } from "react";

export default function Classifier() {
  const [text, setText] = useState("I love Transformers.js!");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    params.append("text", text);
    const url = "/api/classify?" + params.toString();

    fetch(url)
      .then((res) => res.json())
      .then((o) => setResult(o));
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
