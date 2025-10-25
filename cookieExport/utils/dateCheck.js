// utils/dateCheck.js
async function checkDate(expectedDate) {
  try {
    const today = new Date().toISOString().split("T")[0];
    return today === expectedDate;
  } catch (err) {
    console.error("checkDate error:", err);
    return false;
  }
}

async function cleanup(path) {
  try {
    console.log(`Cleaning up file at: ${path}`);
    // MV3 cannot directly delete local files; consider storage or downloads API
    // For production, remove previous export if needed
  } catch (err) {
    console.error("cleanup error:", err);
  }
}

async function checkIfExported(path) {
  try {
    const data = await chrome.storage.local.get(["lastExport"]);
    const today = new Date().toISOString().split("T")[0];
    return data.lastExport === today;
  } catch (err) {
    console.error("checkIfExported error:", err);
    return false;
  }
}

export { checkDate, cleanup, checkIfExported };
