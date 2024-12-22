function formatBytes(bytes, decimals = 0) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1000)), 10);
  const rounded = (bytes / Math.pow(1000, i)).toFixed(decimals);
  return rounded + " " + sizes[i];
}

export default function Progress({ data }) {
  const progress = data.progress ?? 0;
  const text = data.file;

  const a = formatBytes(data.loaded ?? 0);
  const b = formatBytes(data.total ?? 0);
  return (
    <div className="relative text-white text-lg rounded-lg overflow-hidden">
      <div
        className="absolute inset-0 z-0 bg-blue-500"
        style={{ width: `${progress}%` }}
      ></div>
      <div className="relative z-10 p-1">
        {text} ({`${a} / ${b}`})
      </div>
    </div>
  );
}
