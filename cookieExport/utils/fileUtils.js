// utils/fileUtils.js
async function saveCookiesToFile(cookies, path) {
  try {
    const blob = new Blob([JSON.stringify(cookies, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadId = await chrome.downloads.download({
      url,
      filename: path,
      saveAs: false
    });

    console.log(`Cookies saved as ${path}, download ID: ${downloadId}`);
    URL.revokeObjectURL(url);

    const today = new Date().toISOString().split("T")[0];
    await chrome.storage.local.set({ lastExport: today });
  } catch (err) {
    console.error("saveCookiesToFile error:", err);
  }
}

export { saveCookiesToFile };
