import { config } from "../config.js";

export function isTwilioEnabled(): boolean {
  return Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber);
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!isTwilioEnabled()) {
    throw new Error("SMS provider is not configured.");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: config.twilioPhoneNumber,
    Body: body,
  });

  const credentials = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Twilio SMS failed (${response.status}): ${text.slice(0, 200)}`);
  }
}
