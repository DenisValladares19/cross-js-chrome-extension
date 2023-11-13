chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.pageAction.show(tabs[0].id);
  });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status == "complete" && tab.active) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "load-main" });
    });
  }
});
