import { getDB, initSchema, countRows, seedDb, search } from './utils/db';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function App() {
  // Keep track of the classification result and the model loading status.
  const [input, setInput] = useState('');
  const [content, setContent] = useState([]);
  const [result, setResult] = useState(null);
  const [ready, setReady] = useState(null);
  const initailizing = useRef(false);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // Set up DB
  const db = useRef(null);
  useEffect(() => {
    const setup = async () => {
      initailizing.current = true;
      db.current = await getDB();
      await initSchema(db.current);
      let count = await countRows(db.current, 'embeddings');
      console.log(`Found ${count} rows`);
      if (count === 0) {
        await seedDb(db.current);
        count = await countRows(db.current, 'embeddings');
        console.log(`Seeded ${count} rows`);
      }
      // Get Items
      const items = await db.current.query('SELECT content FROM embeddings');
      setContent(items.rows.map((x) => x.content));
    };
    if (!db.current && !initailizing.current) {
      setup();
    }
  }, []);

  // We use the `useEffect` hook to set up the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = async (e) => {
      switch (e.data.status) {
        case 'initiate':
          setReady(false);
          break;
        case 'ready':
          setReady(true);
          break;
        case 'complete':
          // Cosine similarity search in pgvector
          const searchResults = await search(db.current, e.data.embedding);
          console.log({ searchResults });
          setResult(searchResults.map((x) => x.content));
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () =>
      worker.current.removeEventListener('message', onMessageReceived);
  });

  const classify = useCallback((text) => {
    if (worker.current) {
      worker.current.postMessage({ text });
    }
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Transformers.js</h1>
      <h2 className="text-2xl mb-4 text-center">
        100% in-browser Semantic Search with{' '}
        <a
          className="underline"
          href="https://huggingface.co/docs/transformers.js"
        >
          Transformers.js
        </a>
        {', '}
        <a className="underline" href="https://github.com/electric-sql/pglite">
          PGlite
        </a>{' '}
        {' + '}
        <a className="underline" href="https://github.com/pgvector/pgvector">
          pgvector!
        </a>
      </h2>
      <p className="text-center">Items in database:</p>
      <pre className="bg-gray-100 p-2 mb-4 rounded">
        {JSON.stringify(content)}
      </pre>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          classify(input);
        }}
      >
        <input
          type="text"
          className="w-full max-w-xs p-2 border border-gray-300 rounded mb-4"
          placeholder="Enter text here"
          onInput={(e) => {
            setResult([]);
            setInput(e.target.value);
          }}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 mb-4 rounded w-full max-w-xs"
        >
          Semantic Search
        </button>
      </form>

      {ready !== null && (
        <>
          <p className="text-center">Similarity Search results:</p>
          <pre className="bg-gray-100 p-2 rounded">
            {!ready || !result ? 'Loading...' : JSON.stringify(result)}
          </pre>
        </>
      )}
    </main>
  );
}
