// utils/exportCookies.js
async function exportCookies() {
  try {
    const allCookies = await chrome.cookies.getAll({});
    return allCookies;
  } catch (err) {
    console.error("exportCookies error:", err);
    return [];
  }
}

export { exportCookies };
