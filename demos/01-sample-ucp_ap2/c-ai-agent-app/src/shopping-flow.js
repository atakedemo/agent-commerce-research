/**
 * UCP Shopping full-flow demo:
 *   search_catalog → get_product → create_cart → create_checkout
 *   → update_checkout → complete_checkout
 *
 * Returns an array of structured step objects for display.
 */
import { callTool, UCP_META, metaWithKey } from "./mcp-client.js";

export async function runShoppingFlow(client) {
  const steps = [];

  function record(name, tool, { isError, data }) {
    const step = { name, tool, ok: !isError, data };
    steps.push(step);
    return { isError, data };
  }

  // ── Step 1: Search products ─────────────────────────────────────────────────
  const s1 = record(
    "商品を検索",
    "search_catalog",
    await callTool(client, "search_catalog", {
      meta: UCP_META,
      catalog: { query: "running shoes", pagination: { limit: 5 } },
    }),
  );
  if (s1.isError) return steps;

  const product = s1.data.products?.[0];
  if (!product) {
    steps.push({ name: "商品が見つかりません", tool: "-", ok: false, data: {} });
    return steps;
  }

  // ── Step 2: Get product details ─────────────────────────────────────────────
  const s2 = record(
    `商品詳細を取得（${product.title}）`,
    "get_product",
    await callTool(client, "get_product", {
      meta: UCP_META,
      catalog: { id: product.id },
    }),
  );
  if (s2.isError) return steps;

  const variant = s2.data.product?.variants?.[0];

  // ── Step 3: Create cart ─────────────────────────────────────────────────────
  const s3 = record(
    "カートを作成（item_123 を 1 点）",
    "create_cart",
    await callTool(client, "create_cart", {
      meta: UCP_META,
      cart: { line_items: [{ item: { id: "item_123" }, quantity: 1 }] },
    }),
  );
  if (s3.isError) return steps;

  const cart = s3.data;

  // ── Step 4: Create checkout ─────────────────────────────────────────────────
  const s4 = record(
    "チェックアウトを開始",
    "create_checkout",
    await callTool(client, "create_checkout", {
      meta: UCP_META,
      checkout: {
        line_items: variant ? [{ variant_id: variant.id, quantity: 1 }] : [],
        cart_id: cart.id,
      },
    }),
  );
  if (s4.isError) return steps;

  const checkout = s4.data;

  // ── Step 5: Update checkout (shipping info) ─────────────────────────────────
  const s5 = record(
    "配送情報を入力",
    "update_checkout",
    await callTool(client, "update_checkout", {
      meta: UCP_META,
      id: checkout.id,
      checkout: {
        email: "demo-customer@example.com",
        shipping_address: {
          first_name: "Demo",
          last_name: "User",
          address_1: "1-2-3 Shibuya",
          city: "Tokyo",
          country_code: "jp",
          postal_code: "150-0001",
        },
      },
    }),
  );
  if (s5.isError) return steps;

  // ── Step 6: Complete checkout ───────────────────────────────────────────────
  record(
    "注文を確定（デモ決済）",
    "complete_checkout",
    await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: checkout.id,
      checkout: { payment_reference: "demo_payment_ok" },
    }),
  );

  return steps;
}
