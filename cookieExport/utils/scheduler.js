export function nextBackupDate(interval, customDays) {
  const now = new Date();
  switch (interval) {
    case "day": now.setDate(now.getDate() + 1); break;
    case "week": now.setDate(now.getDate() + 7); break;
    case "month": now.setMonth(now.getMonth() + 1); break;
    case "custom": now.setDate(now.getDate() + (customDays || 1)); break;
  }
  return now.toISOString().split("T")[0];
}
