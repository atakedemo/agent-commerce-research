/**
 * Test helper: spawns b-mcp-server via stdio and exposes callTool().
 *
 * Usage:
 *   const { client } = await createMcpClient();
 *   const { isError, data } = await callTool(client, "create_checkout", { meta, checkout });
 *   await client.close();
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, "../../b-mcp-server/src/server.js");

/** meta without idempotency-key (for create / get / update) */
export const META = {
  "ucp-agent": { profile: "https://conformance-test.example/.well-known/ucp" },
};

/** meta with a fresh idempotency-key (for complete / cancel) */
export function metaWithKey(key = randomUUID()) {
  return { ...META, "idempotency-key": key };
}

/**
 * Creates an MCP Client connected to b-mcp-server over stdio.
 * Call client.close() in after() to terminate the server process.
 */
export async function createMcpClient() {
  const client = new Client(
    { name: "ucp-conformance-test", version: "0.1.0" },
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

/**
 * Calls an MCP tool and returns { isError, data }.
 * Never throws — MCP-level errors surface as { isError: true, data: { error } }.
 */
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
