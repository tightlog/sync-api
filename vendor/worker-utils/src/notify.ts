export interface NotifyEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISCORD_WEBHOOK_URL?: string;
}

export type Delivery =
  | 'unconfigured'
  | { ok: true }
  | { ok: false; detail: string };

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  fields: DiscordField[];
  color?: number;
}

export const TELEGRAM_TEXT_MAX = 4096;

const ALERT_RED = 0xdc2626;

interface TelegramMessage {
  chat_id: string;
  text: string;
}

interface DiscordWebhookBody {
  embeds: DiscordEmbed[];
}

async function post(
  url: string,
  body: TelegramMessage | DiscordWebhookBody,
): Promise<Delivery> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok
      ? { ok: true }
      : { ok: false, detail: `HTTP ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function sendTelegram(env: NotifyEnv, text: string): Promise<Delivery> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return Promise.resolve('unconfigured');
  }

  return post(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, TELEGRAM_TEXT_MAX) },
  );
}

export function sendDiscordEmbed(
  env: NotifyEnv,
  embed: DiscordEmbed,
): Promise<Delivery> {
  if (!env.DISCORD_WEBHOOK_URL) {
    return Promise.resolve('unconfigured');
  }

  return post(env.DISCORD_WEBHOOK_URL, {
    embeds: [{ ...embed, color: embed.color ?? ALERT_RED }],
  });
}
