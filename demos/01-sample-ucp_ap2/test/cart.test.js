/**
 * Conformance tests: cart tools
 * Covers mcp-reference.md §6–§8:
 *   create_cart / get_cart / update_cart / cancel_cart
 *
 * Note (mcp-reference.md §2.2):
 *   update_cart is a full replacement, not a diff-patch.
 *   To add an item, the pattern is: get_cart → merge lines → update_cart.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createMcpClient, callTool, META } from "./helpers/mcp-client.js";

// ─── create_cart (§6) ────────────────────────────────────────────────────────

describe("create_cart (§6)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("creates a cart and returns id, line_items, totals, continue_url", async () => {
    const { isError, data } = await callTool(client, "create_cart", {
      meta: META,
      cart: {
        line_items: [{ item: { id: "item_123" }, quantity: 2 }],
        context: { address_country: "US", address_region: "CA" },
      },
    });
    assert.equal(isError, false);
    assert.ok(data.id);
    assert.ok(Array.isArray(data.line_items));
    assert.ok(Array.isArray(data.totals));
    assert.ok(data.continue_url);
  });

  it("creates a cart with no line_items (empty cart)", async () => {
    const { isError, data } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [] },
    });
    assert.equal(isError, false);
    assert.ok(data.id);
  });

  it("returns ucp capability block in response", async () => {
    const { data } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [] },
    });
    assert.ok(data.ucp?.capabilities?.["dev.ucp.shopping.cart"]);
  });
});

// ─── get_cart (§7) ───────────────────────────────────────────────────────────

describe("get_cart (§7)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("retrieves cart snapshot by id", async () => {
    const { data: created } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 1 }] },
    });
    const { isError, data } = await callTool(client, "get_cart", {
      meta: META,
      id: created.id,
    });
    assert.equal(isError, false);
    assert.equal(data.id, created.id);
    assert.equal(data.line_items.length, 1);
  });

  it("returns error for unknown cart id", async () => {
    const { isError } = await callTool(client, "get_cart", {
      meta: META,
      id: "cart_does_not_exist",
    });
    assert.equal(isError, true);
  });
});

// ─── update_cart (§8) ────────────────────────────────────────────────────────

describe("update_cart (§8)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("replaces entire cart with new line_items state", async () => {
    const { data: created } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 1 }] },
    });
    const { isError, data } = await callTool(client, "update_cart", {
      meta: META,
      id: created.id,
      cart: {
        line_items: [
          { item: { id: "item_123" }, quantity: 3 },
          { item: { id: "item_456" }, quantity: 1 },
        ],
      },
    });
    assert.equal(isError, false);
    assert.equal(data.line_items.length, 2);
  });

  it("adding items follows get → merge → update pattern", async () => {
    const { data: created } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 1 }] },
    });
    const { data: current } = await callTool(client, "get_cart", {
      meta: META,
      id: created.id,
    });
    const { isError, data } = await callTool(client, "update_cart", {
      meta: META,
      id: created.id,
      cart: {
        line_items: [
          ...current.line_items,
          { item: { id: "item_new" }, quantity: 2 },
        ],
      },
    });
    assert.equal(isError, false);
    assert.equal(data.line_items.length, current.line_items.length + 1);
  });

  it("recalculates totals after update", async () => {
    const { data: created } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 1 }] },
    });
    const { data } = await callTool(client, "update_cart", {
      meta: META,
      id: created.id,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 2 }] },
    });
    const subtotal = data.totals.find(t => t.type === "subtotal")?.amount;
    assert.ok(subtotal > 0);
  });

  it("returns error for unknown cart id", async () => {
    const { isError } = await callTool(client, "update_cart", {
      meta: META,
      id: "cart_does_not_exist",
      cart: { line_items: [] },
    });
    assert.equal(isError, true);
  });
});

// ─── cancel_cart (§8 / cancel) ───────────────────────────────────────────────

describe("cancel_cart (§8)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("cancels an active cart", async () => {
    const { data: created } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 1 }] },
    });
    const { isError, data } = await callTool(client, "cancel_cart", {
      meta: META,
      id: created.id,
    });
    assert.equal(isError, false);
    assert.equal(data.status, "canceled");
  });

  it("returns error for unknown cart id", async () => {
    const { isError } = await callTool(client, "cancel_cart", {
      meta: META,
      id: "cart_does_not_exist",
    });
    assert.equal(isError, true);
  });

  it("canceled cart cannot be updated", async () => {
    const { data: created } = await callTool(client, "create_cart", {
      meta: META,
      cart: { line_items: [] },
    });
    await callTool(client, "cancel_cart", { meta: META, id: created.id });
    const { isError } = await callTool(client, "update_cart", {
      meta: META,
      id: created.id,
      cart: { line_items: [] },
    });
    assert.equal(isError, true, "updating a canceled cart must be an error");
  });
});
