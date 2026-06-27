browser.runtime.onInstalled.addListener(() => {
  console.log("Fediverse Actions Anyware installed.");
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received from content script:", message);
  sendResponse({ status: "ok" });
});
