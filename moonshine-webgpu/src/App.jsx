import Scene from "./components/Scene";

function App() {
  return (
    // https://github.com/tailwindlabs/tailwindcss/discussions/4515#discussioncomment-4182377
    <Scene className="flex flex-col items-center justify-center w-screen supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh] bg-gray-900" />
  );
}

export default App;
