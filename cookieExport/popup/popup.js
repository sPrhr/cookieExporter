import { notify } from "../utils/notify.js";

const browserApi = typeof chrome !== 'undefined' ? chrome : browser;

// --- Helper function to switch pages ---
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });
  document.getElementById(pageId).style.display = 'block';
}

// --- Main DOMContentLoaded listener ---
document.addEventListener("DOMContentLoaded", async () => {
  // Page 1 Elements (Dashboard)
  const displayLocation = document.getElementById("displayLocation");
  const displaySites = document.getElementById("displaySites");
  const displayEncrypt = document.getElementById("displayEncrypt");
  const lastBackupDisplay = document.getElementById("lastBackup");
  const nextBackupDisplay = document.getElementById("nextBackup");
  const goToPage2Btn = document.getElementById("goToPage2Btn");
  const goToPage3Btn = document.getElementById("goToPage3Btn");
  
  // Page 2 Elements (Settings)
  const intervalSelect = document.getElementById("interval");
  const customContainer = document.getElementById("customIntervalContainer");
  const sitesTextarea = document.getElementById("sites");
  const locationInput = document.getElementById("location");
  const encryptCheck = document.getElementById("encrypt");
  const passwordContainer = document.getElementById("passwordContainer");
  const passwordInput = document.getElementById("password");
  const saveBtn = document.getElementById("saveBtn");
  const backToPage1Btn = document.getElementById("backToPage1Btn");
  
  // Page 3 Elements (Instant Export)
  const instantExportDomainDisplay = document.getElementById("instantExportDomain");
  const exportScopeSelect = document.getElementById("exportScope");
  const instantPasswordContainer = document.getElementById("instantPasswordContainer");
  const instantPasswordInput = document.getElementById("instantPassword");
  const startInstantExportBtn = document.getElementById("startInstantExportBtn");
  const backFromPage3Btn = document.getElementById("backFromPage3Btn");

  let currentSettings = {};

  // --- Load and Display Settings on Startup (Page 1) ---
  const loadSettings = async () => {
    currentSettings = await browserApi.storage.local.get([
      "interval", "customDays", "sites", "location",
      "encrypt", "password", "lastBackup", "nextBackup"
    ]);

    // Page 1: Display
    displayLocation.textContent = currentSettings.location || "Default Downloads Folder";
    displaySites.textContent = (currentSettings.sites || "None").substring(0, 50) + (currentSettings.sites && currentSettings.sites.length > 50 ? '...' : '');
    displayEncrypt.textContent = currentSettings.encrypt ? "Yes" : "No";
    lastBackupDisplay.textContent = currentSettings.lastBackup || "—";
    nextBackupDisplay.textContent = currentSettings.nextBackup || "—";

    // Page 2: Inputs
    intervalSelect.value = currentSettings.interval || "day";
    document.getElementById("customDays").value = currentSettings.customDays || "";
    sitesTextarea.value = currentSettings.sites || "";
    locationInput.value = currentSettings.location || "";
    encryptCheck.checked = currentSettings.encrypt || false;
    passwordInput.value = currentSettings.password || ""; // Note: Should probably be empty for security

    customContainer.style.display = intervalSelect.value === "custom" ? "block" : "none";
    passwordContainer.style.display = encryptCheck.checked ? "block" : "none";
    
    // Page 3: Update visibility based on encryption setting
    if (currentSettings.encrypt) {
        instantPasswordContainer.style.display = 'block';
    } else {
        instantPasswordContainer.style.display = 'none';
    }
  };

  await loadSettings();
  showPage('page-1'); // Start on the dashboard

  // --- Page 2: Settings Event Listeners ---
  intervalSelect.addEventListener("change", () => {
    customContainer.style.display = intervalSelect.value === "custom" ? "block" : "none";
  });

  encryptCheck.addEventListener("change", () => {
    passwordContainer.style.display = encryptCheck.checked ? "block" : "none";
  });
  
  // --- Navigation Event Listeners ---
  goToPage2Btn.addEventListener('click', () => {
      loadSettings(); // Reload settings before going to page 2
      showPage('page-2');
  });
  backToPage1Btn.addEventListener('click', () => showPage('page-1'));
  backFromPage3Btn.addEventListener('click', () => showPage('page-1'));

  // --- Page 2: Save Settings ---
  saveBtn.addEventListener("click", async () => {
    // 1. Check for changes (simplified check, usually you'd compare every field)
    let isChanged = false;
    // ... add more robust change detection here by comparing input values to currentSettings ...
    
    const newSettings = {
        interval: intervalSelect.value,
        customDays: parseInt(document.getElementById("customDays").value) || null,
        sites: sitesTextarea.value.trim(),
        location: locationInput.value.trim(),
        encrypt: encryptCheck.checked,
        password: encryptCheck.checked ? passwordInput.value : ""
    };
    
    // Check if the password field was modified only if encryption is enabled
    if (newSettings.encrypt && newSettings.password !== currentSettings.password) {
        isChanged = true;
    }
    // Check other fields...

    if (!isChanged) { // Simple check placeholder: assuming a change requires password input
        notify("No Changes", "No changes detected to save.");
        return;
    }

    if (newSettings.encrypt && !newSettings.password) {
      notify("Error", "Please provide a password for encryption.");
      return;
    }

    // You would typically ask for the *old* password here before setting a new one,
    // but for simplicity, we'll save it directly.
    
    await browserApi.storage.local.set(newSettings);
    await browserApi.runtime.sendMessage({ type: "updateSchedule" });
    
    await loadSettings(); // Reload and update displays
    notify("Settings Saved", "Your cookie export schedule has been updated.");
    showPage('page-1'); // Go back to dashboard
  });

  // --- Page 3: Instant Export Setup ---
  goToPage3Btn.addEventListener('click', async () => {
    try {
        const tabs = await browserApi.tabs.query({ active: true, currentWindow: true });
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace(/^www\./, '');

        if (domain === "" || domain === "newtab") {
            instantExportDomainDisplay.textContent = "N/A";
            startInstantExportBtn.disabled = true;
            notify("Error", "Cannot export from this tab (e.g., about:blank, newtab).");
        } else {
            instantExportDomainDisplay.textContent = domain;
            startInstantExportBtn.disabled = false;
        }
        
        // Reset inputs on page 3
        exportScopeSelect.value = 'current';
        instantPasswordInput.value = '';

        showPage('page-3');

    } catch (error) {
        instantExportDomainDisplay.textContent = "Error";
        startInstantExportBtn.disabled = true;
        notify("Error", "Could not get current tab information.");
    }
  });
  
  // --- Page 3: Start Export ---
  startInstantExportBtn.addEventListener('click', async () => {
      const scope = exportScopeSelect.value;
      const domain = instantExportDomainDisplay.textContent;
      const password = instantPasswordInput.value;
      const isEncrypted = currentSettings.encrypt; // Use the stored encryption setting
      
      if (isEncrypted && !password) {
          notify("Error", "Please enter the encryption password to proceed.");
          return;
      }
      
      let sitesToExport = [];
      
      switch (scope) {
          case 'current':
              if (domain === "N/A") return;
              sitesToExport = [domain];
              break;
          case 'listed':
              if (currentSettings.sites) {
                 sitesToExport = currentSettings.sites.split(",").map(s => s.trim()).filter(s => s.length > 0);
              }
              break;
          case 'all':
              sitesToExport = ['<all>']; // Signal to the background script to fetch all cookies
              break;
      }

      if (sitesToExport.length === 0) {
          notify("Export Skipped", "No sites selected or configured.");
          return;
      }
      
      // Send the instant export message to the background service worker
      await browserApi.runtime.sendMessage({ 
          type: "instantExport", 
          sites: sitesToExport,
          encrypt: isEncrypted,
          password: password // Pass the password for verification/use
      });

      notify("Export Started", `Exporting ${scope} cookies...`);
      showPage('page-1');
  });
});