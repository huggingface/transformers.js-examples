// content/scripts.js - the content script which is run in the context of web
// pages, and has access to the DOM and other web APIs.
//
// Example usage:
//
// import { ACTION_NAME } from "../constants.js";
// const message = {
//     action: ACTION_NAME,
//     text: 'text to classify',
// }
// const response = await chrome.runtime.sendMessage(message);
// console.log('received user data', response)
//
// This one does not classify by itself. It answers the service worker with
// the page text or the current selection, and the side panel classifies that.

console.log("[From the page context] Hello from content_scripts!");

const MAX_TEXT_LENGTH = 8000;

function getPageContext() {
  const text = (document.body?.innerText ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  return {
    title: document.title,
    url: location.href,
    text,
  };
}

function getSelection() {
  const selection = window.getSelection();
  const text = (selection?.toString() ?? "").trim();

  return {
    title: document.title,
    url: location.href,
    text,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "getPageContext") {
    sendResponse(getPageContext());

    return;
  }

  if (message?.type === "getSelection") {
    sendResponse(getSelection());

    return;
  }
});
