import { nextBackupDate } from "../utils/scheduler.js";
import { encryptData } from "../utils/encrypt.js";
import { notify } from "../utils/notify.js";

const browserApi = typeof chrome !== "undefined" ? chrome : browser;

browserApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "updateSchedule") {
    setupSchedule();
  } else if (msg.type === "instantExport" && msg.domain) {
    runCookieExport({ 
      sites: msg.sites,
      isInstant: true,
      password: msg.password,
      encrypt: msg.encrypt
     });
    return true;
  }
});

browserApi.runtime.onInstalled.addListener(setupSchedule);
browserApi.runtime.onStartup.addListener(setupSchedule);
browserApi.alarms.onAlarm.addListener(handleAlarm);

// ─────────────────────────────────────────────
// Schedule setup
// ─────────────────────────────────────────────
async function setupSchedule() {
  await browserApi.alarms.clearAll();
  const { interval, customDays } = await browserApi.storage.local.get(["interval", "customDays"]);

  const secheduleInterval = interval || "day";

  let minutes;
  switch (secheduleInterval) {
    case "day": minutes = 1440; break;
    case "week": minutes = 10080; break;
    case "month": minutes = 43200; break;
    case "custom": minutes = (customDays || 1) * 1440; break;
    case "off":
      await browserApi.storage.local.set({ nextBackup: "—" });
      return;
  }

  browserApi.alarms.create("cookieExport", { periodInMinutes: minutes });

  const nextBackup = nextBackupDate(interval, customDays);
  await browserApi.storage.local.set({ nextBackup });

  notify("Schedule Set", `Exports will run every ${interval === "custom" ? customDays + " days" : interval}.`);
  console.log("Export scheduled every", minutes, "minutes");
}

// ─────────────────────────────────────────────
// Alarm trigger
// ─────────────────────────────────────────────
async function handleAlarm(alarm) {
  if (alarm.name !== "cookieExport") return;
  await runCookieExport();
}

// ─────────────────────────────────────────────
// Export logic
// ─────────────────────────────────────────────
async function runCookieExport(config = {}) {
  try {
    const isInstant = config.isInstant || false;
    let settings = {};

    if (!isInstant) {
      settings = await browserApi.storage.local.get([
        "sites", "location", "encrypt", "password", "interval", "customDays",
      ]);
    }

    let sitesToExport;
    if (isInstant) {
      sitesToExport = config.sites;
    } else {
      sitesToExport = (settings.sites || "").split(",").map(s => s.trim()).filter(s => s.length > 0);
    }
    
    if (sitesToExport.length === 0) {
      await notify("No Sites Specified", "Please add sites to export in the extension settings.");
      return;
    }

    const encrypt = isInstant ? config.encrypt : (settings.encrypt || false);
    const password = isInstant ? config.password : (settings.password || "");

    const cookies = await exportCookies(sitesToExport);
    let data = JSON.stringify(cookies, null, 2);

    if (encrypt && password) {
      data = await encryptData(data, password);
    }

    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().split("T")[0];
    const locationPath = (settings.location || "").trim().replace(/^\/|\/$/g, '');
    const filename = `${locationPath}${locationPath ? '/' : ''}cookies_${domainPart}_${dateStamp}.json`;
    const domainPart = isInstant ? sitesToExport.length === 1 ? sitesToExport[0].replace(/\./g, '_') : 'instant_export' : 'backup';


    await browserApi.downloads.download({
      url,
      filename: filename,
      saveAs: isInstant,
    });

    URL.revokeObjectURL(url);

    if (!isInstant) {
      const lastBackup = dateStamp;
      const nextBackup = nextBackupDate(settings.interval, settings.customDays);
      await browserApi.storage.local.set({ lastBackup, nextBackup });
    }

    const exportTarget = isInstant ? sitesToExport.join(', ') : locationPath;
    await notify("Backup Complete", `Cookies exported successfully to ${exportTarget}`);
  } catch (err) {
    console.error("runCookieExport Failed:", err);
    await notify(
      "Export Failed",
      err?.message || "An unknown error occurred during cookie export."
    );
  }
}

// ─────────────────────────────────────────────
// Cookie exporter helper
// ─────────────────────────────────────────────
async function exportCookies(sites) {
  if (sites.includes('<all>')) {
    const allCookies = await browserApi.cookies.getAll({});
    const grouped = allCookies.reduce((acc, cookie) => {
      const domain = cookie.domain;
      if (!acc[domain]) acc[domain] = { domain, cookie: [] };
      acc[domain].cookie.push(cookie);
      return acc;
    }, {});
    return Object.values(grouped);
  }

  const allCookies = [];
  for (const site of sites) {
    const domain = site.trim();
    if (!domain) continue;

    try {
      const cookies = await browserApi.cookies.getAll({ domain: domain });
      if (cookies.length > 0) {
        allCookies.push({ domain, cookies });
      }
    } catch (err) {
      console.error(`Failed to get cookies for domain ${domain}:`, err);
    }
  }
  return allCookies;
}