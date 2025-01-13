const CONFIG = {
  defaults: {
    jobTitle: "Software Engineer",
    location: "San Francisco Bay Area",
    jobType: "none",
    experienceLevels: ["2", "3", "4"], // Mid to Senior level
    refreshInterval: 5000, // 5 seconds
    maxApplications: 50,
    autoScroll: true,
  },
  // Add your custom settings here
  custom: {
    jobTitle: "Frontend Engineer",
    location: "Remote",
    maxApplications: 100,
  },
};

// Merge defaults with custom settings
const getConfig = () => {
  return { ...CONFIG.defaults, ...CONFIG.custom };
};

export { getConfig };
