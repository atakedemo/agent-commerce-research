/**
 * UCP Shopping full-flow demo:
 *   search_catalog → get_product → create_cart → create_checkout
 *   → [決済トークン発行 via Payment Handler] → update_checkout → complete_checkout
 *
 * Returns an array of structured step objects for display.
 */
import { callTool, UCP_META, metaWithKey } from "./mcp-client.js";

const PAYMENT_HANDLER_URL = process.env.PAYMENT_HANDLER_URL?.replace(/\/$/, "") ?? null;

/**
 * Calls the Payment Handler /tokenize endpoint with a test payment method.
 * In mock mode (no Stripe key on the handler side), returns a pi_mock_* token.
 */
async function requestPaymentToken(checkoutId, amount = 1000, currency = "jpy") {
  const res = await fetch(`${PAYMENT_HANDLER_URL}/tokenize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      credential: { payment_method_id: "pm_card_visa" },
      binding: { checkout_id: checkoutId },
      amount,
      currency,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tokenize ${res.status}: ${text}`);
  }
  return res.json(); // { token, expiry, _mock? }
}

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
      catalog: { pagination: { limit: 5 } },
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
    `カートを作成（${product.title} を 1 点）`,
    "create_cart",
    await callTool(client, "create_cart", {
      meta: UCP_META,
      cart: { line_items: variant ? [{ item: { id: variant.id }, quantity: 1 }] : [] },
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

  // ── Step 5: 決済トークン発行 (Payment Handler) ──────────────────────────────
  // create_checkout レスポンスに payment_handlers が含まれる場合に実行する
  let paymentToken = null;
  if (PAYMENT_HANDLER_URL && checkout.checkout?.payment_handlers) {
    const tokenResult = await (async () => {
      try {
        const result = await requestPaymentToken(checkout.id);
        return { isError: false, data: result };
      } catch (e) {
        return { isError: true, data: { error: e.message } };
      }
    })();
    const s5 = record("決済トークンを発行", "POST /tokenize", tokenResult);
    if (!s5.isError) paymentToken = s5.data.token;
  }

  // ── Step 6: Update checkout (shipping info) ─────────────────────────────────
  const s6 = record(
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
  if (s6.isError) return steps;

  // ── Step 7: Complete checkout ───────────────────────────────────────────────
  const completePayload = paymentToken
    ? {
        payment: {
          instruments: [{
            type: "card",
            credential: { token: paymentToken },
            display: { brand: "Visa", last4: "4242" },
          }],
        },
      }
    : { payment_reference: "demo_payment_ok" };

  record(
    paymentToken
      ? "注文を確定（Payment Handler トークン決済）"
      : "注文を確定（デモ決済）",
    "complete_checkout",
    await callTool(client, "complete_checkout", {
      meta: metaWithKey(),
      id: checkout.id,
      checkout: completePayload,
    }),
  );

  return steps;
}
