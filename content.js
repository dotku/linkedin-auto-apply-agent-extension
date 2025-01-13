// Use IIFE to avoid global scope pollution
(async () => {
  const configModulePath = chrome.runtime.getURL("config.js");
  const { getConfig } = await import(configModulePath);

  const config = getConfig();
  console.log("config", config);
  // Check if script is already running
  if (window.linkedInAutoApplyAgent) {
    console.log("LinkedIn Auto Apply Agent already initialized");
    return;
  }

  // Create a namespace for our extension
  window.linkedInAutoApplyAgent = {
    isRunning: false,
    jobsApplied: 0,
    settings: {
      jobTitle: config.jobTitle,
      jobType: config.jobType,
      location: config.location,
      easyApplyOnly: true,
    },
  };

  // Main message listener
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    console.log("Content script received message:", request);
    if (request.action === "START_APPLYING") {
      console.log(
        "Starting auto-apply process with settings:",
        request.settings
      );
      if (request.settings) {
        window.linkedInAutoApplyAgent.settings = {
          jobTitle: request.settings.jobTitle || "Software Engineer",
          jobType: request.settings.jobType || "none",
          location: request.settings.location || "San Francisco Bay Area",
          easyApplyOnly: true,
        };
      }
      window.linkedInAutoApplyAgent.isRunning = true;
      startAutoApply();
    } else if (request.action === "STOP_APPLYING") {
      console.log("Stopping auto-apply process");
      window.linkedInAutoApplyAgent.isRunning = false;
    }
  });

  // Helper function to build search URL
  function buildSearchUrl(settings) {
    const baseUrl = "https://www.linkedin.com/jobs/search/";
    const params = new URLSearchParams({
      keywords: settings.jobTitle,
      location: settings.location,
      f_AL: true, // Easy Apply only
      sortBy: "R", // Sort by Most Recent
    });

    // Add job type filter if specified
    if (settings.jobType && settings.jobType !== "none") {
      params.append("f_WT", settings.jobType);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  // Helper function to check if on jobs page
  function isOnJobsPage() {
    console.log("window.location.href", window.location.href);
    return window.location.href.includes("linkedin.com/jobs/search");
  }

  // Helper function to navigate to job search
  async function navigateToJobSearch() {
    if (!window.linkedInAutoApplyAgent.settings) {
      console.error("No settings found");
      return false;
    }

    const searchUrl = buildSearchUrl(window.linkedInAutoApplyAgent.settings);
    console.log("Search URL:", searchUrl);

    const currentParams = new URL(window.location.href).searchParams;
    const targetParams = new URL(searchUrl).searchParams;
    if (
      !isOnJobsPage() ||
      !currentParams.toString() === targetParams.toString()
    ) {
      console.log(
        "!isOnJobsPage(), window.location.href !== searchUrl",
        !isOnJobsPage(),
        window.location.href !== searchUrl
      );
      // window.location.href = searchUrl;
      return true;
    }
    return false;
  }

  // Helper function to check if job is easy apply
  function isEasyApplyJob(card) {
    // Check for the Easy Apply button/label
    const easyApplyButton = card.querySelector(".jobs-apply-button");
    const easyApplyLabel = card.querySelector('[aria-label*="Easy Apply"]');
    const easyApplyText = card.textContent.includes("Easy Apply");

    return easyApplyButton || easyApplyLabel || easyApplyText;
  }

  // Main auto-apply function
  async function startAutoApply() {
    console.log("Starting auto-apply process");

    // If not on jobs page or need to apply filters, navigate first
    if (!isOnJobsPage() || (await navigateToJobSearch())) {
      console.log("Navigating to jobs search page");
      return;
    }

    console.log("On correct jobs page, starting to process jobs");
    while (window.linkedInAutoApplyAgent.isRunning) {
      // Wait for job cards to load
      await wait(2000);
      const jobCards = document.querySelectorAll(".job-card-container");
      console.log("Found", jobCards.length, "job cards");

      if (jobCards.length === 0) {
        console.log("No job cards found, waiting and retrying...");
        await wait(2000);
        continue;
      }

      for (let card of jobCards) {
        if (!window.linkedInAutoApplyAgent.isRunning) break;

        // Always check for Easy Apply
        if (!isEasyApplyJob(card)) {
          console.log("Skipping non-Easy Apply job");
          continue;
        }

        // Check job details for skill match
        const jobTitle =
          card
            .querySelector(".artdeco-entity-lockup__title")
            ?.textContent?.trim() || "";
        const jobCompany =
          card
            .querySelector(".artdeco-entity-lockup__subtitle")
            ?.textContent?.trim() || "";

        console.log("Processing Easy Apply job:", {
          title: jobTitle,
          company: jobCompany,
        });

        // Click on the job card to view details
        card.click();
        await wait(2000);

        // Find and click the Easy Apply button
        const easyApplyButton = document.querySelector(
          'button[aria-label*="Easy Apply to"]'
        );
        if (easyApplyButton) {
          console.log("Found Easy Apply button, clicking it");
          easyApplyButton.click();
          await wait(1000);

          // Handle the application process
          const applied = await handleApplicationProcess();
          if (applied) {
            window.linkedInAutoApplyAgent.jobsApplied++;
            updateJobCount();
            console.log(
              "Successfully applied to job. Total jobs applied:",
              window.linkedInAutoApplyAgent.jobsApplied
            );
          } else {
            console.log("Failed to complete application process");
          }
        } else {
          console.log("No Easy Apply button found for this job");
        }

        await wait(2000);
      }

      // Scroll to load more jobs
      console.log("Scrolling to load more jobs");
      window.scrollTo(0, document.body.scrollHeight);
      await wait(2000);

      // If no more jobs are loading, refresh the search
      const oldJobCount = jobCards.length;
      const newJobCards = document.querySelectorAll(".job-card-container");
      if (newJobCards.length === oldJobCount) {
        console.log("No more jobs loading, refreshing search");
        await navigateToJobSearch();
        return;
      }
    }
  }

  // Helper function to handle application process
  async function handleApplicationProcess() {
    let maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      await wait(1000);

      // Check for any error messages or problems
      const errorMessages = document.querySelectorAll(
        ".artdeco-inline-feedback--error"
      );
      if (errorMessages.length > 0) {
        console.log("Found error messages:", errorMessages[0].textContent);
        return false;
      }

      // Check for next button
      const nextButton = document.querySelector(
        'button[aria-label="Continue to next step"]'
      );
      if (nextButton) {
        console.log("Clicking next button");
        nextButton.click();
        continue;
      }

      // Check for review button
      const reviewButton = document.querySelector(
        'button[aria-label="Review your application"]'
      );
      if (reviewButton) {
        console.log("Clicking review button");
        reviewButton.click();
        continue;
      }

      // Check for submit button
      const submitButton = document.querySelector(
        'button[aria-label="Submit application"]'
      );
      if (submitButton) {
        console.log("Clicking submit button");
        submitButton.click();
        await wait(1000);

        // Close the success dialog if present
        const closeButton = document.querySelector(
          'button[aria-label="Dismiss"]'
        );
        if (closeButton) {
          console.log("Closing success dialog");
          closeButton.click();
        }
        return true;
      }

      // Check if we're stuck (no actionable buttons found)
      const buttons = document.querySelectorAll("button");
      if (buttons.length === 0) {
        console.log("No buttons found, breaking application process");
        return false;
      }
    }

    console.log("Exceeded maximum attempts in application process");
    return false;
  }

  // Helper function to update job count
  function updateJobCount() {
    chrome.runtime.sendMessage({
      type: "UPDATE_COUNT",
      count: window.linkedInAutoApplyAgent.jobsApplied,
    });
  }

  // Helper function for waiting
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Initialize any required setup
  console.log("LinkedIn Auto Apply Agent initialized");
})();
