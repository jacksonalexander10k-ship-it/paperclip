export async function sendWhatsApp(opts: {
  to: string;
  message: string;
  apiKey?: string;
  phoneNumberId?: string;
  accessToken?: string;
}): Promise<{ status: "sent" | "stub" | "error"; messageId?: string; error?: string }> {
  const apiKey = opts.apiKey ?? opts.accessToken;
  if (!apiKey) {
    return { status: "stub", error: "No API key provided. Connect WhatsApp first." };
  }

  const phone = opts.to.replace(/\+/g, "");
  try {
    const res = await fetch("https://waba.360dialog.io/v1/messages", {
      method: "POST",
      headers: {
        "D360-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        type: "text",
        text: { body: opts.message },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { status: "error", error: `360dialog: ${res.status} ${body}` };
    }

    const data = await res.json() as { messages?: Array<{ id: string }> };
    return { status: "sent", messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function searchWhatsApp(_opts: {
  query?: string;
  contactName?: string;
  phone?: string;
}): Promise<{ status: "stub"; message: string }> {
  return { status: "stub", message: "WhatsApp search not yet implemented." };
}
