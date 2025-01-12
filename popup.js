document.addEventListener("DOMContentLoaded", function () {
  console.log("Popup loaded");

  const startButton = document.getElementById("startApplying");
  const stopButton = document.getElementById("stopApplying");
  const statusText = document.getElementById("status");
  const jobCountText = document.getElementById("jobCount");

  // Get all filter elements
  const jobTitleInput = document.getElementById("jobTitle");
  const locationInput = document.getElementById("location");

  // Load saved settings
  chrome.storage.local.get(["jobTitle", "location"], function (result) {
    console.log("Loaded settings:", result);
    jobTitleInput.value = result.jobTitle || "Software Engineer";
    locationInput.value = result.location || "San Francisco Bay Area";
  });

  // Save settings when changed
  function saveSettings() {
    const settings = {
      jobTitle: jobTitleInput.value,
      location: locationInput.value,
    };
    console.log("Saving settings:", settings);
    chrome.storage.local.set(settings);
  }

  // Add change listeners to all inputs
  [jobTitleInput, locationInput].forEach((element) => {
    element.addEventListener("change", saveSettings);
  });

  startButton.addEventListener("click", function () {
    console.log("Start button clicked");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]?.url?.includes("linkedin.com")) {
        statusText.textContent = "Please navigate to LinkedIn";
        return;
      }

      const settings = {
        jobTitle: jobTitleInput.value,
        location: locationInput.value,
      };

      console.log("Sending START_APPLYING message with settings:", settings);
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "START_APPLYING",
          settings: settings,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            statusText.textContent = "Error: Could not start";
            return;
          }
          console.log("Message sent successfully");
        }
      );
    });
    statusText.textContent = "Running";
    startButton.disabled = true;
    stopButton.disabled = false;
  });

  stopButton.addEventListener("click", function () {
    console.log("Stop button clicked");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_APPLYING" });
    });
    statusText.textContent = "Stopped";
    startButton.disabled = false;
    stopButton.disabled = true;
  });

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    console.log("Popup received message:", request);
    if (request.type === "UPDATE_COUNT") {
      jobCountText.textContent = request.count;
    }
  });
});
