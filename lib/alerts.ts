import "server-only";

// Tells the developer something is wrong — never the shop owner, who has
// nothing to do about a technical fault. Sends to whichever of these is
// configured (both optional; with neither, the error is only logged):
//  - ALERT_NTFY_TOPIC: a secret topic name on ntfy.sh; install the free ntfy
//    app and subscribe to the same topic to get a push notification.
//  - ALERT_WEBHOOK_URL: a Discord or Slack incoming-webhook URL.
// The message must never contain personal data: it leaves the system.
export async function sendAlert(title: string, message: string): Promise<void> {
  const topic = process.env.ALERT_NTFY_TOPIC;
  const webhook = process.env.ALERT_WEBHOOK_URL;
  const tasks: Promise<unknown>[] = [];

  if (topic) {
    tasks.push(
      fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
        method: "POST",
        // Header values must be plain ASCII; the message body can be anything.
        headers: { Title: title.replace(/[^\x20-\x7e]/g, "?"), Priority: "high", Tags: "warning" },
        body: message,
        signal: AbortSignal.timeout(4000),
      })
    );
  }
  if (webhook) {
    tasks.push(
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // "content" is what Discord reads, "text" what Slack reads.
        body: JSON.stringify({ content: `${title}: ${message}`, text: `${title}: ${message}` }),
        signal: AbortSignal.timeout(4000),
      })
    );
  }

  await Promise.allSettled(tasks);
}
