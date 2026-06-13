/**
 * MCP client helper — spawns b-mcp-server via stdio and exposes callTool().
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, "../../b-mcp-server/src/server.js");

export const UCP_META = {
  "ucp-agent": { profile: "https://demo-agent.example/.well-known/ucp" },
};

export function metaWithKey(key = randomUUID()) {
  return { ...UCP_META, "idempotency-key": key };
}

export async function createMcpClient() {
  const client = new Client(
    { name: "ucp-agent-demo", version: "0.1.0" },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
    env: { ...process.env },
  });
  await client.connect(transport);
  return client;
}

export async function callTool(client, name, args) {
  try {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.[0]?.text ?? "{}";
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { isError: result.isError === true, data };
  } catch (err) {
    return { isError: true, data: { error: err.message } };
  }
}
