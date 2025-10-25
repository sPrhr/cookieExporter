import { notify } from "../utils/notify.js";

const browserApi = typeof chrome !== 'undefined' ? chrome : browser;

document.addEventListener("DOMContentLoaded", async () => {
  const intervalSelect = document.getElementById("interval");
  const customContainer = document.getElementById("customIntervalContainer");
  const encryptCheck = document.getElementById("encrypt");
  const passwordContainer = document.getElementById("passwordContainer");
  const saveBtn = document.getElementById("saveBtn");
  const exportCurrentBtn = document.getElementById("saveCurrentBtn")

  // Load saved settings
  const data = await browserApi.storage.local.get([
    "interval", "customDays", "sites", "location",
    "encrypt", "password", "lastBackup", "nextBackup"
  ]);

  intervalSelect.value = data.interval || "day";
  document.getElementById("customDays").value = data.customDays || "";
  document.getElementById("sites").value = data.sites || "";
  document.getElementById("location").value = data.location || "";
  encryptCheck.checked = data.encrypt || false;
  document.getElementById("password").value = data.password || "";
  document.getElementById("lastBackup").textContent = data.lastBackup || "—";
  document.getElementById("nextBackup").textContent = data.nextBackup || "—";

  customContainer.style.display = intervalSelect.value === "custom" ? "block" : "none";
  passwordContainer.style.display = encryptCheck.checked ? "block" : "none";

  // Toggle custom interval/password fields
  intervalSelect.addEventListener("change", () => {
    customContainer.style.display = intervalSelect.value === "custom" ? "block" : "none";
  });

  encryptCheck.addEventListener("change", () => {
    passwordContainer.style.display = encryptCheck.checked ? "block" : "none";
  });

  // Instant export
  exportCurrentBtn.addEventListener("click", async () => {
    try {
      const tabs = await browserApi.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];

      if (!currentTab || !currentTab.url) {
        notify("Error", "Could not determine the current site.", "error");
        return;
      }
      
      const url = new URL(currentTab.url);
      const domain = url.hostname.replace(/^www\./, '');

      if (domain === "" || domain === "newtab") {
        notify("Error", "No valid site found in the current tab.", "error");
        return;
      }

      await browserApi.runtime.sendMessage({
        type: "instantExport",
        domain: domain
      });

      notify("Export started", `Exporting cookies for ${domain}...`);
    } catch (error) {
      console.error("Instant export failed:", error);
      notify("Export failed", "Couldn't start instant export. Check permission.", "error")
    }
  });

  // Save settings
  saveBtn.addEventListener("click", async () => {
    const settings = {
      interval: intervalSelect.value,
      customDays: parseInt(document.getElementById("customDays").value) || null,
      sites: document.getElementById("sites").value.trim(),
      location: document.getElementById("location").value.trim(),
      encrypt: encryptCheck.checked,
      password: encryptCheck.checked ? document.getElementById("password").value : ""
    };

    if (settings.encrypt && !settings.password) {
      notify("Error", "Please provide a password for encryption.", "error");
      return;
    }

    await browserApi.storage.local.set(settings);

    await browserApi.runtime.sendMessage({ type: "updateSchedule" });

    notify("Settings Saved", "Your cookie export schedule has been updated.");
  });
});