import { Client, middleware } from "@line/bot-sdk";

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

// Singleton LINE client
let lineClient: Client | null = null;

export function getLineClient(): Client {
  if (!lineClient) {
    lineClient = new Client(lineConfig);
  }
  return lineClient;
}

export function getLineMiddleware() {
  return middleware(lineConfig);
}

/** Create a LINE client for a specific tenant */
export function createTenantLineClient(
  channelAccessToken: string,
  channelSecret: string
): Client {
  return new Client({ channelAccessToken, channelSecret });
}
