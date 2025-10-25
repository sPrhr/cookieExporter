const browserApi = typeof chrome !== "undefined" ? chrome : browser;

export async function notify(title, message, type = "basic") {
  try {
    await browserApi.notifications.create({
      type,
      iconUrl: "../icons/icon48.png",
      title,
      message,
    });
  } catch (err) {
    console.warn("Notification failed:", err);
  }
}
