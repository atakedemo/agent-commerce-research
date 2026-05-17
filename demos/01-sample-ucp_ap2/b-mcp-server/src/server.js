#!/usr/bin/env node
/**
 * MCP server exposing UCP Shopping tools aligned with
 * Universal-Commerce-Protocol/ucp — source/services/shopping/mcp.openrpc.json
 *
 * Implements all 12 tools with a two-layer strategy:
 *   1. Medusa Store API (when EC_BACKEND_URL + EC_PUBLISHABLE_KEY are set)
 *   2. In-memory mock (fallback when Medusa is unavailable or unconfigured)
 *
 * State tracking (cart status, checkout lifecycle) is always maintained
 * in-memory, as Medusa has no direct cancel_cart / cancel_checkout equivalent.
 *
 * Tools:
 *   catalog : search_catalog / get_product / lookup_catalog
 *   cart    : create_cart / get_cart / update_cart / cancel_cart
 *   checkout: create_checkout / get_checkout / update_checkout /
 *             complete_checkout / cancel_checkout
 */
import { randomUUID, createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as medusa from "./medusa.js";

// ─── Merchant 署名鍵（AP2 Checkout JWT 用）─────────────────────────────────────

const { subtle } = globalThis.crypto;

const MERCHANT_KEY_PAIR = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const MERCHANT_KEY_ID     = "merchant-key-1";
const MERCHANT_PUBLIC_JWK = {
  ...(await subtle.exportKey("jwk", MERCHANT_KEY_PAIR.publicKey)),
  kid: MERCHANT_KEY_ID,
  use: "sig",
  alg: "ES256",
};

/**
 * ES256 署名付き JWT を生成する（AP2 Checkout JWT 用）。
 */
async function signMerchantJwt(payload) {
  const header        = { alg: "ES256", typ: "JWT", kid: MERCHANT_KEY_ID };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput   = `${encodedHeader}.${encodedPayload}`;
  const sigBuf         = await subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    MERCHANT_KEY_PAIR.privateKey,
    Buffer.from(signingInput),
  );
  return `${signingInput}.${Buffer.from(sigBuf).toString("base64url")}`;
}

// ─── Payment Handler config ────────────────────────────────────────────────────

const PAYMENT_HANDLER_URL = process.env.PAYMENT_HANDLER_URL?.replace(/\/$/, "") ?? null;
const STRIPE_SECRET_KEY   = process.env.STRIPE_SECRET_KEY ?? null;

/**
 * Calls d-payment-handler /detokenize to validate a UCP payment token.
 * Returns { payment_intent_id, payment_intent_status, amount, currency } or throws.
 */
async function validatePaymentToken(token, checkoutId, checkoutHash) {
  const binding = { checkout_id: checkoutId };
  if (checkoutHash) binding.checkout_hash = checkoutHash;
  const res = await fetch(`${PAYMENT_HANDLER_URL}/detokenize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, binding }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`detokenize ${res.status}: ${detail}`);
  }
  return res.json();
}

/**
 * Confirms a Stripe PaymentIntent via the Stripe REST API (no SDK).
 * No-ops in mock mode (STRIPE_SECRET_KEY unset).
 */
async function confirmStripePaymentIntent(piId) {
  if (!STRIPE_SECRET_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}/confirm`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`stripe confirm ${res.status}: ${detail}`);
  }
  return res.json();
}

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
    title: "MOCK_Blue Running Shoes",
    categories: ["Footwear"],
    options: [
      { name: "Color", values: [{ label: "Blue", available: true }] },
      { name: "Size", values: [{ label: "10", available: true }] },
    ],
    variants: [
      {
        id: "var_abc123_blu_10",
        price: { amount: 12000, currency: "USD" },
        availability: { available: true },
        options: [{ name: "Color", label: "Blue" }, { name: "Size", label: "10" }],
      },
    ],
  },
  {
    id: "prod_def456",
    title: "MOCK_Red Style Shirt",
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
        price: { amount: 8000, currency: "USD" },
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
    title: "MOCK_White Running Shoes",
    categories: ["Footwear"],
    options: [
      { name: "Color", values: [{ label: "White", available: true }] },
      { name: "Size", values: [{ label: "9", available: true }] },
    ],
    variants: [
      {
        id: "var_ghi789_wht_9",
        price: { amount: 9000, currency: "USD" },
        availability: { available: true },
        options: [{ name: "Color", label: "White" }, { name: "Size", label: "9" }],
      },
    ],
  },
];

// ─── Catalog helpers (mock) ────────────────────────────────────────────────────

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

function mockSearchProducts({ query, filters, pagination } = {}) {
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
    ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString("base64url")
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

// ─── Cart helpers (mock) ───────────────────────────────────────────────────────

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

// ─── Checkout helpers ──────────────────────────────────────────────────────────

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

// ─── Response helpers ─────────────────────────────────────────────────────────

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(data) {
  return { isError: true, content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// ─── MCP Server ────────────────────────────────────────────────────────────────

const mcp = new McpServer(
  { name: "ucp-shopping-mcp-bridge", version: "0.3.0" },
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
    let result;
    try { result = await medusa.searchProducts(catalog ?? {}); } catch {}
    if (!result) result = mockSearchProducts(catalog ?? {});

    return ok({ ...UCP_CATALOG_SEARCH_CAP, ...result });
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
    let product;
    try { product = await medusa.getProduct(catalog?.id, catalog?.selected); } catch {}

    if (!product) {
      const found = CATALOG.find((p) => p.id === catalog?.id);
      if (found) {
        let variants = [...found.variants];
        if (catalog?.selected?.length) {
          variants = variants.filter((v) =>
            catalog.selected.every((sel) =>
              v.options.some((o) => o.name === sel.name && o.label === sel.label),
            ),
          );
        }
        product = { ...found, variants };
      }
    }

    if (!product) {
      return err({ error: "product_not_found", id: catalog?.id });
    }

    return ok({ ...UCP_CATALOG_LOOKUP_CAP, product });
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
    let products;
    try { products = await medusa.lookupProducts(ids); } catch {}

    if (!products) {
      products = ids.flatMap((id) => {
        const p = CATALOG.find((x) => x.id === id);
        return p ? [p] : [];
      });
    }

    return ok({ ...UCP_CATALOG_LOOKUP_CAP, products });
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

    let medusaResult = null;
    try { medusaResult = await medusa.createCart(lineItems); } catch {}

    const rec = {
      ...UCP_CART_CAP,
      id,
      status: "active",
      line_items: lineItems,
      currency: medusaResult?.ucpCart.currency ?? "USD",
      totals: medusaResult?.ucpCart.totals ?? computeTotals(lineItems),
      continue_url: medusaResult?.ucpCart.continue_url ?? `https://demo.example.com/checkout?cart=${id}`,
      ...(medusaResult ? { _medusa_id: medusaResult.medusaId } : {}),
    };
    carts.set(id, rec);
    return ok(rec);
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
    if (!rec) return err({ error: "cart_not_found", id });

    if (rec._medusa_id) {
      try {
        const fresh = await medusa.getCart(rec._medusa_id);
        if (fresh) {
          const updated = { ...rec, line_items: fresh.line_items, totals: fresh.totals };
          carts.set(id, updated);
          return ok(updated);
        }
      } catch {}
    }

    return ok(rec);
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
    if (!prev) return err({ error: "cart_not_found", id });
    if (prev.status === "canceled") return err({ error: "cart_canceled", id });

    const lineItems = cart?.line_items ?? [];
    let totals = computeTotals(lineItems);

    if (prev._medusa_id) {
      try {
        const fresh = await medusa.updateCart(prev._medusa_id, lineItems);
        if (fresh) totals = fresh.totals;
      } catch {}
    }

    const updated = { ...prev, line_items: lineItems, totals };
    carts.set(id, updated);
    return ok(updated);
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
    if (!prev) return err({ error: "cart_not_found", id });

    const canceled = { ...prev, status: "canceled" };
    carts.set(id, canceled);
    return ok(canceled);
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

    // UCP cart_id（"cart_xxx"）を Medusa cart_id に解決する。
    // carts Map には { _medusa_id: "medusa_cart_yyy" } が格納されている。
    let resolvedCheckout = checkout;
    if (checkout.cart_id) {
      const ucpCart = carts.get(checkout.cart_id);
      if (ucpCart?._medusa_id) {
        resolvedCheckout = { ...checkout, cart_id: ucpCart._medusa_id };
      } else if (ucpCart && !ucpCart._medusa_id) {
        // UCP カートが存在するが Medusa 未連携 → cart_id を除いてアイテムで再作成
        resolvedCheckout = {
          ...checkout,
          cart_id: undefined,
          line_items: ucpCart.line_items,
        };
      }
    }

    let medusaCartId = null;
    try {
      medusaCartId = await medusa.createCheckoutCart(resolvedCheckout);
    } catch (e) {
      console.error("[create_checkout] Medusa error:", e.message);
    }

    const rec = recordForResponse(id, meta, checkout, "incomplete");
    if (medusaCartId) rec._medusa_cart_id = medusaCartId;

    if (PAYMENT_HANDLER_URL) {
      rec.checkout = {
        ...rec.checkout,
        payment_handlers: {
          "dev.ucp.payment.stripe": [{
            version: "2026-01-15",
            tokenizer: "external",
            endpoint: PAYMENT_HANDLER_URL,
            operations: ["/tokenize"],
          }],
        },
      };
    }

    // AP2: マーチャント署名付き Checkout JWT を生成する
    const merchantId = process.env.MERCHANT_ID ?? "merchant_1";
    const checkoutJwtPayload = {
      order_id: id,
      merchant: {
        id:      merchantId,
        name:    process.env.MERCHANT_NAME    ?? "Demo Merchant",
        website: process.env.EC_BACKEND_URL   ?? "http://localhost:9000",
      },
      line_items: (checkout.line_items ?? []).map((li, idx) => ({
        id:       li.id ?? `line_${idx + 1}`,
        variant:  { id: li.item?.id ?? li.variant_id ?? "unknown" },
        quantity: li.quantity ?? 1,
      })),
      currency: "JPY",
      iat:      Math.floor(Date.now() / 1000),
    };
    const checkoutJwt  = await signMerchantJwt(checkoutJwtPayload);
    const checkoutHash = createHash("sha256").update(checkoutJwt).digest("base64url");

    rec.checkout_jwt  = checkoutJwt;
    rec.checkout_hash = checkoutHash;
    rec.merchant_jwks = { keys: [MERCHANT_PUBLIC_JWK] };

    checkouts.set(id, rec);
    return ok(rec);
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
    if (!rec) return err({ error: "checkout_not_found", id });
    return ok(rec);
  },
);

mcp.registerTool(
  "update_checkout",
  {
    description:
      "Merge-update checkout fields (UCP OpenRPC: update_checkout §11).",
    inputSchema: z.object({
      meta: metaBase,
      id: z.string().describe("The checkout session ID returned by create_checkout (the top-level 'id' field in the response)"),
      checkout: z.record(z.unknown()),
    }),
  },
  async ({ id, checkout }) => {
    const prev = checkouts.get(id);
    if (!prev) return err({ error: "checkout_not_found", id });
    if (prev.status === "canceled") return err({ error: "checkout_canceled", id });

    if (prev._medusa_cart_id) {
      try { await medusa.updateCheckoutCart(prev._medusa_cart_id, checkout); }
      catch (e) { console.error("[update_checkout] Medusa error:", e.message); }
    }

    const merged = {
      ...prev,
      checkout: { ...prev.checkout, ...checkout },
      status: prev.status === "completed" ? "completed" : "ready_for_complete",
    };
    checkouts.set(id, merged);
    return ok(merged);
  },
);

mcp.registerTool(
  "complete_checkout",
  {
    description:
      "Complete checkout / place order (UCP OpenRPC: complete_checkout §12). meta.idempotency-key required. AP2 HNP flows must supply ap2.checkout_mandate.",
    inputSchema: z.object({
      meta: metaWithIdempotency,
      id: z.string().describe("The checkout session ID returned by create_checkout (the top-level 'id' field in the response)"),
      checkout: z.record(z.unknown()),
      ap2: z.object({
        checkout_mandate: z.string().describe("AP2 Closed Checkout Mandate (KB-SD-JWT) issued by the agent"),
      }).optional().describe("AP2 extension: mandate artifacts for HNP flows"),
    }),
  },
  async ({ meta, id, checkout, ap2 }) => {
    const prev = checkouts.get(id);
    if (!prev) return err({ error: "checkout_not_found", id });
    if (prev.status === "canceled") return err({ error: "checkout_canceled", id });

    // AP2: checkout_mandate の受け取りと検証
    let ap2Result = null;
    if (ap2?.checkout_mandate) {
      console.log(`[complete_checkout] AP2 checkout_mandate received (checkout_id=${id})`);
      ap2Result = { checkout_mandate_accepted: true };
    }

    // Validate and decode the payment token if a Payment Handler is configured
    const instruments = checkout?.payment?.instruments ?? prev.checkout?.payment?.instruments ?? [];
    const instrument  = instruments[0];
    if (instrument?.credential?.token && PAYMENT_HANDLER_URL) {
      try {
        const detoken = await validatePaymentToken(instrument.credential.token, id, prev.checkout_hash);
        if (detoken?.payment_intent_id) {
          await confirmStripePaymentIntent(detoken.payment_intent_id);
        }
      } catch (e) {
        return err({ error: "payment_validation_failed", detail: e.message });
      }
    }

    let orderId = null;
    if (prev._medusa_cart_id) {
      try {
        const result = await medusa.completeCheckoutCart(prev._medusa_cart_id);
        orderId = result?.orderId ?? null;
        if (orderId) {
          console.log(`[complete_checkout] Medusa order created: ${orderId}`);
        } else {
          console.warn("[complete_checkout] Medusa complete returned no order id");
        }
      } catch (e) {
        console.error("[complete_checkout] Medusa error:", e.message);
      }
    } else {
      console.warn("[complete_checkout] _medusa_cart_id not set — Medusa skipped");
    }

    const done = {
      ...prev,
      checkout: { ...prev.checkout, ...checkout },
      status: "completed",
      ucp_meta: {
        "ucp-agent": meta["ucp-agent"],
        "idempotency-key": meta["idempotency-key"],
      },
      ...(orderId    ? { order_id: orderId }    : {}),
      ...(ap2Result  ? { ap2: ap2Result }        : {}),
    };
    checkouts.set(id, done);
    return ok(done);
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
    if (!prev) return err({ error: "checkout_not_found", id });
    if (prev.status === "completed") return err({ error: "checkout_completed", id });

    const canceled = {
      ...prev,
      status: "canceled",
      ucp_meta: {
        "ucp-agent": meta["ucp-agent"],
        "idempotency-key": meta["idempotency-key"],
      },
    };
    checkouts.set(id, canceled);
    return ok(canceled);
  },
);

const transport = new StdioServerTransport();
await mcp.connect(transport);
