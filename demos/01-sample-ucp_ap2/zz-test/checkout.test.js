/**
 * Conformance tests: checkout tools
 * Covers mcp-reference.md §9–§13:
 *   create_checkout / get_checkout / update_checkout / complete_checkout / cancel_checkout
 *
 * Reference: https://github.com/Universal-Commerce-Protocol/conformance
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createMcpClient,
  callTool,
  META,
  metaWithKey,
} from "./helpers/mcp-client.js";

const LINE_ITEMS = [{ variant_id: "variant_01EXAMPLE", quantity: 1 }];

describe("create_checkout (§9)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("returns id starting with co_ and status=incomplete", async () => {
    const { isError, data } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });
    assert.equal(isError, false);
    assert.match(data.id, /^co_/);
    assert.equal(data.status, "incomplete");
  });

  it("echoes ucp-agent profile in ucp_meta", async () => {
    const { isError, data } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    assert.equal(isError, false);
    assert.equal(
      data.ucp_meta?.["ucp-agent"]?.profile,
      META["ucp-agent"].profile,
    );
  });

  it("stores checkout payload in checkout field", async () => {
    const { isError, data } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });
    assert.equal(isError, false);
    assert.deepEqual(data.checkout?.line_items, LINE_ITEMS);
  });

  it("accepts idempotency-key in meta without error", async () => {
    const { isError } = await callTool(client, "create_checkout", {
      meta: metaWithKey(),
      checkout: {},
    });
    assert.equal(isError, false);
  });
});

describe("get_checkout (§10)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("retrieves a previously created checkout by id", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });

    const { isError, data } = await callTool(client, "get_checkout", {
      meta: META,
      id: created.id,
    });
    assert.equal(isError, false);
    assert.equal(data.id, created.id);
    assert.equal(data.status, "incomplete");
  });

  it("returns checkout_not_found for unknown id", async () => {
    const { isError, data } = await callTool(client, "get_checkout", {
      meta: META,
      id: `co_${randomUUID()}`,
    });
    assert.equal(isError, true);
    assert.equal(data.error, "checkout_not_found");
  });
});

describe("update_checkout (§11)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("merges fields and transitions to ready_for_complete", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });

    const { isError, data } = await callTool(client, "update_checkout", {
      meta: META,
      id: created.id,
      checkout: {
        email: "shopper@example.com",
        shipping_address: {
          first_name: "A",
          last_name: "B",
          address_1: "1 Main St",
          city: "Copenhagen",
          country_code: "dk",
          postal_code: "2100",
        },
      },
    });
    assert.equal(isError, false);
    assert.equal(data.status, "ready_for_complete");
    assert.equal(data.checkout?.email, "shopper@example.com");
  });

  it("preserves existing checkout fields after partial update", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });

    const { data } = await callTool(client, "update_checkout", {
      meta: META,
      id: created.id,
      checkout: { email: "buyer@example.com" },
    });
    assert.deepEqual(data.checkout?.line_items, LINE_ITEMS);
  });

  it("returns checkout_not_found for unknown id", async () => {
    const { isError, data } = await callTool(client, "update_checkout", {
      meta: META,
      id: `co_${randomUUID()}`,
      checkout: { email: "x@example.com" },
    });
    assert.equal(isError, true);
    assert.equal(data.error, "checkout_not_found");
  });
});

describe("complete_checkout (§12)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("transitions to completed and echoes idempotency-key", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });

    const key = randomUUID();
    const { isError, data } = await callTool(client, "complete_checkout", {
      meta: metaWithKey(key),
      id: created.id,
      checkout: { payment_reference: "demo_pending" },
    });
    assert.equal(isError, false);
    assert.equal(data.status, "completed");
    assert.equal(data.ucp_meta?.["idempotency-key"], key);
  });

  it("returns checkout_not_found for unknown id", async () => {
    const { isError, data } = await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: `co_${randomUUID()}`,
      checkout: {},
    });
    assert.equal(isError, true);
    assert.equal(data.error, "checkout_not_found");
  });
});

describe("cancel_checkout (§13)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("transitions to canceled and echoes idempotency-key", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });

    const key = randomUUID();
    const { isError, data } = await callTool(client, "cancel_checkout", {
      meta: metaWithKey(key),
      id: created.id,
    });
    assert.equal(isError, false);
    assert.equal(data.status, "canceled");
    assert.equal(data.ucp_meta?.["idempotency-key"], key);
  });

  it("returns checkout_not_found for unknown id", async () => {
    const { isError, data } = await callTool(client, "cancel_checkout", {
      meta: metaWithKey(),
      id: `co_${randomUUID()}`,
    });
    assert.equal(isError, true);
    assert.equal(data.error, "checkout_not_found");
  });
});

describe("lifecycle: create → update → complete", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("transitions incomplete → ready_for_complete → completed", async () => {
    const { data: c1 } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: { line_items: LINE_ITEMS },
    });
    assert.equal(c1.status, "incomplete");

    const { data: c2 } = await callTool(client, "update_checkout", {
      meta: META,
      id: c1.id,
      checkout: { email: "buyer@example.com" },
    });
    assert.equal(c2.status, "ready_for_complete");

    const { data: c3 } = await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: c1.id,
      checkout: {},
    });
    assert.equal(c3.status, "completed");
  });

  it("get_checkout reflects final completed state", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: created.id,
      checkout: {},
    });

    const { data } = await callTool(client, "get_checkout", {
      meta: META,
      id: created.id,
    });
    assert.equal(data.status, "completed");
  });
});

describe("lifecycle: create → cancel", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("transitions incomplete → canceled", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    assert.equal(created.status, "incomplete");

    const { data: canceled } = await callTool(client, "cancel_checkout", {
      meta: metaWithKey(),
      id: created.id,
    });
    assert.equal(canceled.status, "canceled");
  });

  it("get_checkout reflects final canceled state", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    await callTool(client, "cancel_checkout", {
      meta: metaWithKey(),
      id: created.id,
    });

    const { data } = await callTool(client, "get_checkout", {
      meta: META,
      id: created.id,
    });
    assert.equal(data.status, "canceled");
  });
});

describe("state invariants", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("update_checkout: completed checkout keeps completed status", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: created.id,
      checkout: {},
    });

    const { data } = await callTool(client, "update_checkout", {
      meta: META,
      id: created.id,
      checkout: { note: "post-complete-update" },
    });
    assert.equal(data.status, "completed");
  });

  it("complete_checkout: cannot complete a canceled checkout", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    await callTool(client, "cancel_checkout", {
      meta: metaWithKey(),
      id: created.id,
    });

    const { isError } = await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: created.id,
      checkout: {},
    });
    assert.equal(isError, true, "completing a canceled checkout must be an error");
  });

  it("update_checkout: cannot update a canceled checkout", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    await callTool(client, "cancel_checkout", {
      meta: metaWithKey(),
      id: created.id,
    });

    const { isError } = await callTool(client, "update_checkout", {
      meta: META,
      id: created.id,
      checkout: { note: "post-cancel-update" },
    });
    assert.equal(isError, true, "updating a canceled checkout must be an error");
  });

  it("cancel_checkout: cannot cancel a completed checkout", async () => {
    const { data: created } = await callTool(client, "create_checkout", {
      meta: META,
      checkout: {},
    });
    await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: created.id,
      checkout: {},
    });

    const { isError } = await callTool(client, "cancel_checkout", {
      meta: metaWithKey(),
      id: created.id,
    });
    assert.equal(isError, true, "canceling a completed checkout must be an error");
  });
});
