// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension installed');
  // Initialize settings
  chrome.storage.local.set({
    easyApplyOnly: true,
    jobsApplied: 0
  });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/jobs')) {
    console.log('LinkedIn jobs page detected');
    
    // Inject content script manually to ensure it's loaded
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected successfully');
    }).catch((err) => {
      console.error('Failed to inject content script:', err);
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  if (request.type === 'UPDATE_COUNT') {
    chrome.storage.local.set({ jobsApplied: request.count });
  }
});
