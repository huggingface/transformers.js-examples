export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("zh", {
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
  });
}
