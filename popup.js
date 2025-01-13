import { getConfig } from "./config.js";

document.addEventListener("DOMContentLoaded", function () {
  const config = getConfig();

  console.log("Popup loaded");

  const startButton = document.getElementById("startApplying");
  const stopButton = document.getElementById("stopApplying");
  const statusText = document.getElementById("status");
  const jobCountText = document.getElementById("jobCount");
  const titleElement = document.querySelector("h2");

  // Get manifest version and update title
  const manifestData = chrome.runtime.getManifest();
  titleElement.textContent = `LinkedIn Job Apply Agent v${manifestData.version}`;

  // Get all filter elements
  const jobTitleInput = document.getElementById("jobTitle");
  const jobTypeSelect = document.getElementById("jobType");
  const locationInput = document.getElementById("location");

  // Load saved settings
  chrome.storage.local.get(
    ["jobTitle", "jobType", "location"],
    function (result) {
      console.log("Loaded settings:", result);
      jobTitleInput.value = result.jobTitle || config.jobTitle;
      jobTypeSelect.value = result.jobType || config.jobType;
      locationInput.value = result.location || config.location;
    }
  );

  // Save settings when changed
  function saveSettings() {
    const settings = {
      jobTitle: jobTitleInput.value,
      jobType: jobTypeSelect.value,
      location: locationInput.value,
    };
    console.log("Saving settings:", settings);
    chrome.storage.local.set(settings);
  }

  // Add change listeners to all inputs
  [jobTitleInput, jobTypeSelect, locationInput].forEach((element) => {
    element.addEventListener("change", saveSettings);
  });

  // Function to inject content script if needed
  async function ensureContentScriptInjected(tabId) {
    try {
      await chrome.scripting
        .executeScript({
          target: { tabId: tabId },
          func: () => {
            return window.linkedInAutoApplyAgent !== undefined;
          },
        })
        .then(async (result) => {
          const isInjected = result[0]?.result;
          console.log("Content script check result:", isInjected);

          if (!isInjected) {
            console.log("Injecting content script...");
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ["content.js"],
            });
            console.log("Content script injected");
          }
        });
      return true;
    } catch (error) {
      console.error("Error checking/injecting content script:", error);
      return false;
    }
  }

  startButton.addEventListener("click", async function () {
    console.log("Start button clicked");
    statusText.textContent = "Initializing...";

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      console.log("Current tabs:", tabs);

      if (!tabs || tabs.length === 0) {
        throw new Error("No active tab found");
      }

      const currentTab = tabs[0];
      console.log("Current tab:", currentTab);

      if (!currentTab.url) {
        throw new Error("Cannot access current page");
      }

      if (!currentTab.url.includes("linkedin.com")) {
        throw new Error("Please navigate to LinkedIn first");
      }

      // Ensure content script is injected
      const injected = await ensureContentScriptInjected(currentTab.id);
      if (!injected) {
        throw new Error(
          "Failed to initialize extension. Please refresh the page"
        );
      }

      const settings = {
        jobTitle: jobTitleInput.value,
        jobType: jobTypeSelect.value,
        location: locationInput.value,
      };

      console.log("Sending START_APPLYING message with settings:", settings);

      // Send message with timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Message timeout")), 5000)
      );

      const messagePromise = new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          currentTab.id,
          {
            action: "START_APPLYING",
            settings: settings,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      });

      await Promise.race([messagePromise, timeout]);

      // If we get here, the message was sent successfully
      console.log("Message sent successfully");
      statusText.textContent = "Running";
      startButton.disabled = true;
      stopButton.disabled = false;
    } catch (error) {
      console.error("Error starting:", error);
      statusText.textContent = `Error: ${error.message}`;
      // Try to inject content script again if it failed
      if (error.message.includes("Cannot establish connection")) {
        statusText.textContent = "Error: Please refresh the LinkedIn page";
      }
    }
  });

  stopButton.addEventListener("click", function () {
    console.log("Stop button clicked");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]?.id) {
        statusText.textContent = "Error: Cannot access tab";
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "STOP_APPLYING" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error stopping:", chrome.runtime.lastError);
            statusText.textContent =
              "Error: Could not stop. Please refresh the page";
            return;
          }
          statusText.textContent = "Stopped";
          startButton.disabled = false;
          stopButton.disabled = true;
        }
      );
    });
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
    } else if (request.type === "ERROR") {
      statusText.textContent = `Error: ${request.message}`;
      startButton.disabled = false;
      stopButton.disabled = true;
    } else if (request.type === "STATUS") {
      statusText.textContent = request.message;
    }
  });
});
