/**
 * Conformance tests: catalog tools
 * Covers mcp-reference.md §3–§5:
 *   search_catalog / get_product / lookup_catalog
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createMcpClient, callTool, META } from "./helpers/mcp-client.js";

// ─── search_catalog (§3) ────────────────────────────────────────────────────

describe("search_catalog (§3)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("returns products array and pagination for a keyword query", async () => {
    const { isError, data } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: {
        query: "blue running shoes",
        pagination: { limit: 20 },
      },
    });
    assert.equal(isError, false);
    assert.ok(Array.isArray(data.products));
    assert.ok(data.pagination);
  });

  it("returns empty products array when no results match", async () => {
    const { isError, data } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: { query: "zzz_nonexistent_product_xyz" },
    });
    assert.equal(isError, false);
    assert.deepEqual(data.products, []);
  });

  it("supports filter by category", async () => {
    const { isError, data } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: {
        query: "shoes",
        filters: { categories: ["Footwear"] },
      },
    });
    assert.equal(isError, false);
    assert.ok(Array.isArray(data.products));
  });

  it("supports price filter (max)", async () => {
    const { isError, data } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: {
        query: "shoes",
        filters: { price: { max: 15000 } },
      },
    });
    assert.equal(isError, false);
    for (const p of data.products) {
      assert.ok(p.variants.every(v => v.price.amount <= 15000));
    }
  });

  it("supports pagination via limit and cursor", async () => {
    const { data: page1 } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: { query: "shoes", pagination: { limit: 1 } },
    });
    assert.ok(page1.pagination.has_next_page);
    const { data: page2 } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: { query: "shoes", pagination: { limit: 1, cursor: page1.pagination.cursor } },
    });
    assert.notDeepEqual(page2.products[0].id, page1.products[0].id);
  });

  it("returns ucp capability block in response", async () => {
    const { data } = await callTool(client, "search_catalog", {
      meta: META,
      catalog: { query: "anything" },
    });
    assert.ok(data.ucp?.capabilities?.["dev.ucp.shopping.catalog.search"]);
  });
});

// ─── get_product (§4) ────────────────────────────────────────────────────────

describe("get_product (§4)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("returns product details by id including options and variants", async () => {
    const { isError, data } = await callTool(client, "get_product", {
      meta: META,
      catalog: { id: "prod_abc123" },
    });
    assert.equal(isError, false);
    assert.equal(data.product.id, "prod_abc123");
    assert.ok(Array.isArray(data.product.options));
    assert.ok(Array.isArray(data.product.variants));
  });

  it("filters variants when selected options are provided", async () => {
    const { data } = await callTool(client, "get_product", {
      meta: META,
      catalog: {
        id: "prod_abc123",
        selected: [{ name: "Color", label: "Blue" }],
      },
    });
    assert.ok(data.product.variants.every(v =>
      v.options.some(o => o.name === "Color" && o.label === "Blue")
    ));
  });

  it("returns error for unknown product id", async () => {
    const { isError } = await callTool(client, "get_product", {
      meta: META,
      catalog: { id: "prod_does_not_exist" },
    });
    assert.equal(isError, true);
  });
});

// ─── lookup_catalog (§5) ─────────────────────────────────────────────────────

describe("lookup_catalog (§5)", () => {
  let client;
  before(async () => { client = await createMcpClient(); });
  after(async () => { await client.close(); });

  it("resolves multiple product ids in a single call", async () => {
    const { isError, data } = await callTool(client, "lookup_catalog", {
      meta: META,
      catalog: { ids: ["prod_abc123", "prod_def456"] },
    });
    assert.equal(isError, false);
    assert.equal(data.products.length, 2);
  });

  it("returns only found ids when some ids are unknown", async () => {
    const { data } = await callTool(client, "lookup_catalog", {
      meta: META,
      catalog: { ids: ["prod_abc123", "prod_does_not_exist"] },
    });
    assert.equal(data.products.length, 1);
    assert.equal(data.products[0].id, "prod_abc123");
  });

  it("returns ucp capability block in response", async () => {
    const { data } = await callTool(client, "lookup_catalog", {
      meta: META,
      catalog: { ids: ["prod_abc123"] },
    });
    assert.ok(data.ucp?.capabilities?.["dev.ucp.shopping.catalog.lookup"]);
  });
});
