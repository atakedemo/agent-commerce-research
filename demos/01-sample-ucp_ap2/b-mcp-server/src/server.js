#!/usr/bin/env node
/**
 * MCP server exposing UCP Shopping checkout tools aligned with
 * Universal-Commerce-Protocol/ucp — source/services/shopping/mcp.openrpc.json
 *
 * This demo keeps checkout state in-memory and optionally mirrors cart
 * operations to Medusa when EC_BACKEND_URL + EC_PUBLISHABLE_KEY are set.
 */
import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const metaBase = z
  .object({
    "ucp-agent": z.object({
      profile: z.string().url(),
    }),
    "idempotency-key": z.string().uuid().optional(),
    signature: z.string().optional(),
  })
  .passthrough();

const metaWithIdempotency = metaBase.extend({
  "idempotency-key": z.string().uuid(),
});

const checkouts = new Map();

function checkoutId() {
  return `co_${randomUUID()}`;
}

function recordForResponse(id, meta, checkoutPayload, status) {
  return {
    id,
    status,
    ucp_meta: {
      "ucp-agent": meta["ucp-agent"],
      ...(meta["idempotency-key"]
        ? { "idempotency-key": meta["idempotency-key"] }
        : {}),
    },
    checkout: checkoutPayload,
  };
}

async function medusaCreateCart(lineItemSummary) {
  const base = process.env.EC_BACKEND_URL?.replace(/\/$/, "");
  const pk = process.env.EC_PUBLISHABLE_KEY;
  if (!base || !pk) return null;

  const res = await fetch(`${base}/store/carts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": pk,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    return { medusa_error: await res.text(), status: res.status };
  }
  const data = await res.json();
  return { cart: data.cart, lineItemSummary };
}

const mcp = new McpServer(
  {
    name: "ucp-shopping-mcp-bridge",
    version: "0.1.0",
  },
  {
    instructions:
      "Checkout tools follow UCP Shopping mcp.openrpc.json (create/get/update/complete/cancel_checkout). Requires meta.ucp-agent.profile; complete/cancel require meta.idempotency-key.",
  },
);

mcp.registerTool(
  "create_checkout",
  {
    description: "Create a new checkout session (UCP OpenRPC: create_checkout).",
    inputSchema: z.object({
      meta: metaBase,
      checkout: z.record(z.unknown()),
    }),
  },
  async ({ meta, checkout }) => {
    const id = checkoutId();
    const mirrored = await medusaCreateCart(checkout?.line_items ?? checkout);
    const status = mirrored?.cart ? "incomplete" : "incomplete";
    const rec = recordForResponse(id, meta, { ...checkout, _ec_mirror: mirrored }, status);
    checkouts.set(id, rec);
    return {
      content: [{ type: "text", text: JSON.stringify(rec, null, 2) }],
    };
  },
);

mcp.registerTool(
  "get_checkout",
  {
    description: "Fetch checkout by id (UCP OpenRPC: get_checkout).",
    inputSchema: z.object({
      meta: metaBase,
      id: z.string(),
    }),
  },
  async ({ id }) => {
    const rec = checkouts.get(id);
    if (!rec) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "checkout_not_found", id },
              null,
              2,
            ),
          },
        ],
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  },
);

mcp.registerTool(
  "update_checkout",
  {
    description: "Update checkout (UCP OpenRPC: update_checkout).",
    inputSchema: z.object({
      meta: metaBase,
      id: z.string(),
      checkout: z.record(z.unknown()),
    }),
  },
  async ({ id, checkout }) => {
    const prev = checkouts.get(id);
    if (!prev) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "checkout_not_found", id }, null, 2),
          },
        ],
      };
    }
    const merged = {
      ...prev,
      checkout: { ...prev.checkout, ...checkout },
      status: prev.status === "completed" ? "completed" : "ready_for_complete",
    };
    checkouts.set(id, merged);
    return { content: [{ type: "text", text: JSON.stringify(merged, null, 2) }] };
  },
);

mcp.registerTool(
  "complete_checkout",
  {
    description:
      "Complete checkout / place order (UCP OpenRPC: complete_checkout). meta.idempotency-key required.",
    inputSchema: z.object({
      meta: metaWithIdempotency,
      id: z.string(),
      checkout: z.record(z.unknown()),
    }),
  },
  async ({ meta, id, checkout }) => {
    const prev = checkouts.get(id);
    if (!prev) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "checkout_not_found", id }, null, 2),
          },
        ],
      };
    }
    const done = {
      ...prev,
      checkout: { ...prev.checkout, ...checkout },
      status: "completed",
      ucp_meta: {
        "ucp-agent": meta["ucp-agent"],
        "idempotency-key": meta["idempotency-key"],
      },
    };
    checkouts.set(id, done);
    return { content: [{ type: "text", text: JSON.stringify(done, null, 2) }] };
  },
);

mcp.registerTool(
  "cancel_checkout",
  {
    description: "Cancel checkout (UCP OpenRPC: cancel_checkout). meta.idempotency-key required.",
    inputSchema: z.object({
      meta: metaWithIdempotency,
      id: z.string(),
    }),
  },
  async ({ meta, id }) => {
    const prev = checkouts.get(id);
    if (!prev) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "checkout_not_found", id }, null, 2),
          },
        ],
      };
    }
    const canceled = {
      ...prev,
      status: "canceled",
      ucp_meta: {
        "ucp-agent": meta["ucp-agent"],
        "idempotency-key": meta["idempotency-key"],
      },
    };
    checkouts.set(id, canceled);
    return { content: [{ type: "text", text: JSON.stringify(canceled, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await mcp.connect(transport);
