const getWebhookUrl = () => process.env.NOTIFICATION_WEBHOOK_URL;

export async function notify(payload: {
  taskId: string;
  status: "complete" | "failed";
  message: string;
  prUrl?: string;
}): Promise<void> {
  const url = getWebhookUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Notification failed", { err, payload });
  }
}
