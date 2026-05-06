#!/usr/bin/env node
/**
 * MCP server exposing UCP Shopping tools aligned with
 * Universal-Commerce-Protocol/ucp — source/services/shopping/mcp.openrpc.json
 *
 * Implements all 12 tools (mock in-memory):
 *   catalog : search_catalog / get_product / lookup_catalog
 *   cart    : create_cart / get_cart / update_cart / cancel_cart
 *   checkout: create_checkout / get_checkout / update_checkout /
 *             complete_checkout / cancel_checkout
 */
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Schema helpers ────────────────────────────────────────────────────────────

const metaBase = z
  .object({
    "ucp-agent": z.object({ profile: z.string().url() }),
    "idempotency-key": z.string().uuid().optional(),
    signature: z.string().optional(),
  })
  .passthrough();

const metaWithIdempotency = metaBase.extend({
  "idempotency-key": z.string().uuid(),
});

// ─── In-memory stores ─────────────────────────────────────────────────────────

const checkouts = new Map();
const carts = new Map();

// ─── Mock catalog data ─────────────────────────────────────────────────────────

const CATALOG = [
  {
    id: "prod_abc123",
    title: "Blue Running Shoes",
    categories: ["Footwear"],
    options: [
      { name: "Color", values: [{ label: "Blue", available: true }] },
      { name: "Size", values: [{ label: "10", available: true }] },
    ],
    variants: [
      {
        id: "var_abc123_blu_10",
        price: { amount: 12.00, currency: "USD" },
        availability: { available: true },
        options: [{ name: "Color", label: "Blue" }, { name: "Size", label: "10" }],
      },
    ],
  },
  {
    id: "prod_def456",
    title: "Red Style Shirt",
    categories: ["Clothing"],
    options: [
      { name: "Color", values: [{ label: "Red", available: true }] },
      {
        name: "Size",
        values: [
          { label: "M", available: true },
          { label: "L", available: true },
        ],
      },
    ],
    variants: [
      {
        id: "var_def456_red_m",
        price: { amount: 8.99, currency: "USD" },
        availability: { available: true },
        options: [{ name: "Color", label: "Red" }, { name: "Size", label: "M" }],
      },
      {
        id: "var_def456_red_l",
        price: { amount: 8500, currency: "USD" },
        availability: { available: true },
        options: [{ name: "Color", label: "Red" }, { name: "Size", label: "L" }],
      },
    ],
  },
  {
    id: "prod_ghi789",
    title: "White Running Shoes",
    categories: ["Footwear"],
    options: [
      { name: "Color", values: [{ label: "White", available: true }] },
      { name: "Size", values: [{ label: "9", available: true }] },
    ],
    variants: [
      {
        id: "var_ghi789_wht_9",
        price: { amount: 9.99, currency: "USD" },
        availability: { available: true },
        options: [{ name: "Color", label: "White" }, { name: "Size", label: "9" }],
      },
    ],
  },
];

// ─── Catalog helpers ───────────────────────────────────────────────────────────

const UCP_CATALOG_SEARCH_CAP = {
  ucp: {
    version: "2026-01-15",
    capabilities: { "dev.ucp.shopping.catalog.search": [{ version: "2026-01-15" }] },
  },
};

const UCP_CATALOG_LOOKUP_CAP = {
  ucp: {
    version: "2026-01-15",
    capabilities: { "dev.ucp.shopping.catalog.lookup": [{ version: "2026-01-15" }] },
  },
};

function searchProducts({ query, filters, pagination } = {}) {
  let results = [...CATALOG];

  if (query) {
    const q = query.toLowerCase();
    results = results.filter((p) => p.title.toLowerCase().includes(q));
  }

  if (filters?.categories?.length) {
    results = results.filter((p) =>
      p.categories.some((c) => filters.categories.includes(c)),
    );
  }

  if (filters?.price?.max != null) {
    results = results.filter((p) =>
      p.variants.every((v) => v.price.amount <= filters.price.max),
    );
  }

  const limit = pagination?.limit ?? 20;
  let offset = 0;
  if (pagination?.cursor) {
    try {
      offset = JSON.parse(
        Buffer.from(pagination.cursor, "base64url").toString(),
      ).offset;
    } catch {}
  }

  const page = results.slice(offset, offset + limit);
  const hasNext = offset + limit < results.length;
  const nextCursor = hasNext
    ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString(
        "base64url",
      )
    : undefined;

  return {
    products: page,
    pagination: {
      total_count: results.length,
      has_next_page: hasNext,
      ...(nextCursor ? { cursor: nextCursor } : {}),
    },
  };
}

// ─── Cart helpers ──────────────────────────────────────────────────────────────

const UCP_CART_CAP = {
  ucp: {
    version: "2026-01-15",
    capabilities: { "dev.ucp.shopping.cart": [{ version: "2026-01-15" }] },
  },
};

const ITEM_PRICES = { item_123: 2500, item_456: 1200, item_new: 3000 };

function computeTotals(lineItems = []) {
  const subtotal = lineItems.reduce((sum, li) => {
    const price = ITEM_PRICES[li.item?.id] ?? 1000;
    return sum + price * (li.quantity ?? 1);
  }, 0);
  return [
    { type: "subtotal", amount: subtotal, currency: "USD" },
    { type: "total", amount: subtotal, currency: "USD" },
  ];
}

// ─── Checkout helpers ─────────────────────────────────────────────────────────

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

// ─── MCP Server ────────────────────────────────────────────────────────────────

const mcp = new McpServer(
  { name: "ucp-shopping-mcp-bridge", version: "0.2.0" },
  {
    instructions:
      "UCP Shopping MCP (12 tools): catalog (search_catalog, get_product, lookup_catalog), cart (create_cart, get_cart, update_cart, cancel_cart), checkout (create_checkout, get_checkout, update_checkout, complete_checkout, cancel_checkout). Requires meta.ucp-agent.profile; complete/cancel_checkout require meta.idempotency-key.",
  },
);

// ─── Catalog tools ─────────────────────────────────────────────────────────────

mcp.registerTool(
  "search_catalog",
  {
    description:
      "Search catalog by keyword, filters, and pagination (UCP: search_catalog §3).",
    inputSchema: z.object({
      meta: metaBase,
      catalog: z.record(z.unknown()),
    }),
  },
  async ({ catalog }) => {
    const result = searchProducts(catalog ?? {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ...UCP_CATALOG_SEARCH_CAP, ...result },
            null,
            2,
          ),
        },
      ],
    };
  },
);

mcp.registerTool(
  "get_product",
  {
    description:
      "Get product details by id, optionally filtered by selected options (UCP: get_product §4).",
    inputSchema: z.object({
      meta: metaBase,
      catalog: z.record(z.unknown()),
    }),
  },
  async ({ catalog }) => {
    const product = CATALOG.find((p) => p.id === catalog?.id);
    if (!product) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "product_not_found", id: catalog?.id },
              null,
              2,
            ),
          },
        ],
      };
    }

    let variants = [...product.variants];
    if (catalog?.selected?.length) {
      variants = variants.filter((v) =>
        catalog.selected.every((sel) =>
          v.options.some((o) => o.name === sel.name && o.label === sel.label),
        ),
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ...UCP_CATALOG_LOOKUP_CAP, product: { ...product, variants } },
            null,
            2,
          ),
        },
      ],
    };
  },
);

mcp.registerTool(
  "lookup_catalog",
  {
    description:
      "Resolve multiple product ids in one call (UCP: lookup_catalog §5).",
    inputSchema: z.object({
      meta: metaBase,
      catalog: z.record(z.unknown()),
    }),
  },
  async ({ catalog }) => {
    const ids = catalog?.ids ?? [];
    const products = ids.flatMap((id) => {
      const p = CATALOG.find((x) => x.id === id);
      return p ? [p] : [];
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ...UCP_CATALOG_LOOKUP_CAP, products },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Cart tools ────────────────────────────────────────────────────────────────

mcp.registerTool(
  "create_cart",
  {
    description:
      "Create a new cart session with optional line_items (UCP: create_cart §6).",
    inputSchema: z.object({
      meta: metaBase,
      cart: z.record(z.unknown()),
    }),
  },
  async ({ cart }) => {
    const id = `cart_${randomUUID()}`;
    const lineItems = cart?.line_items ?? [];
    const rec = {
      ...UCP_CART_CAP,
      id,
      status: "active",
      line_items: lineItems,
      currency: "USD",
      totals: computeTotals(lineItems),
      continue_url: `https://demo.example.com/checkout?cart=${id}`,
    };
    carts.set(id, rec);
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  },
);

mcp.registerTool(
  "get_cart",
  {
    description: "Get cart snapshot by id (UCP: get_cart §7).",
    inputSchema: z.object({
      meta: metaBase,
      id: z.string(),
    }),
  },
  async ({ id }) => {
    const rec = carts.get(id);
    if (!rec) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "cart_not_found", id }, null, 2),
          },
        ],
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  },
);

mcp.registerTool(
  "update_cart",
  {
    description:
      "Replace entire cart state with new line_items (UCP: update_cart §8, full replacement).",
    inputSchema: z.object({
      meta: metaBase,
      id: z.string(),
      cart: z.record(z.unknown()),
    }),
  },
  async ({ id, cart }) => {
    const prev = carts.get(id);
    if (!prev) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "cart_not_found", id }, null, 2),
          },
        ],
      };
    }
    if (prev.status === "canceled") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "cart_canceled", id }, null, 2),
          },
        ],
      };
    }
    const lineItems = cart?.line_items ?? [];
    const updated = { ...prev, line_items: lineItems, totals: computeTotals(lineItems) };
    carts.set(id, updated);
    return {
      content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
    };
  },
);

mcp.registerTool(
  "cancel_cart",
  {
    description: "Cancel an active cart (UCP: cancel_cart §8).",
    inputSchema: z.object({
      meta: metaBase,
      id: z.string(),
    }),
  },
  async ({ id }) => {
    const prev = carts.get(id);
    if (!prev) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "cart_not_found", id }, null, 2),
          },
        ],
      };
    }
    const canceled = { ...prev, status: "canceled" };
    carts.set(id, canceled);
    return {
      content: [{ type: "text", text: JSON.stringify(canceled, null, 2) }],
    };
  },
);

// ─── Checkout tools ────────────────────────────────────────────────────────────

mcp.registerTool(
  "create_checkout",
  {
    description:
      "Create a new checkout session (UCP OpenRPC: create_checkout §9).",
    inputSchema: z.object({
      meta: metaBase,
      checkout: z.record(z.unknown()),
    }),
  },
  async ({ meta, checkout }) => {
    const id = `co_${randomUUID()}`;
    const mirrored = await medusaCreateCart(checkout?.line_items ?? checkout);
    const rec = recordForResponse(
      id,
      meta,
      { ...checkout, _ec_mirror: mirrored },
      "incomplete",
    );
    checkouts.set(id, rec);
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  },
);

mcp.registerTool(
  "get_checkout",
  {
    description: "Fetch checkout by id (UCP OpenRPC: get_checkout §10).",
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
            text: JSON.stringify({ error: "checkout_not_found", id }, null, 2),
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
    description:
      "Merge-update checkout fields (UCP OpenRPC: update_checkout §11).",
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
    if (prev.status === "canceled") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "checkout_canceled", id }, null, 2),
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
    return {
      content: [{ type: "text", text: JSON.stringify(merged, null, 2) }],
    };
  },
);

mcp.registerTool(
  "complete_checkout",
  {
    description:
      "Complete checkout / place order (UCP OpenRPC: complete_checkout §12). meta.idempotency-key required.",
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
    if (prev.status === "canceled") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "checkout_canceled", id }, null, 2),
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
    description:
      "Cancel checkout (UCP OpenRPC: cancel_checkout §13). meta.idempotency-key required.",
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
    if (prev.status === "completed") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "checkout_completed", id }, null, 2),
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
    return {
      content: [{ type: "text", text: JSON.stringify(canceled, null, 2) }],
    };
  },
);

const transport = new StdioServerTransport();
await mcp.connect(transport);
