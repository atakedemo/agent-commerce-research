/**
 * Medusa Store API client with UCP format mappers.
 *
 * Every exported function returns null when EC_BACKEND_URL is unset,
 * allowing server.js to fall back to the in-memory mock seamlessly.
 *
 * Required env vars (both must be set to enable Medusa mode):
 *   EC_BACKEND_URL       e.g. http://localhost:9000
 *   EC_PUBLISHABLE_KEY   e.g. pk_...
 */

function ecBase() { return process.env.EC_BACKEND_URL?.replace(/\/$/, "") ?? null; }
function ecPK()   { return process.env.EC_PUBLISHABLE_KEY ?? null; }

async function mFetch(path, options = {}) {
  const base = ecBase();
  if (!base) return null;
  const res = await fetch(`${base}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(ecPK() ? { "x-publishable-api-key": ecPK() } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`Medusa ${res.status}: ${path}`);
  return res.json();
}

// ── Catalog mappers ────────────────────────────────────────────────────────────

function variantToUcp(v) {
  const amount = v.calculated_price?.calculated_amount ?? v.original_price ?? 0;
  const currency = (v.calculated_price?.currency_code ?? "usd").toUpperCase();
  return {
    id: v.id,
    price: { amount, currency },
    availability: { available: true },
    options: (v.options ?? []).map(o => ({ name: o.option?.title ?? "", label: o.value })),
  };
}

function productToUcp(p) {
  return {
    id: p.id,
    title: p.title,
    categories: (p.categories ?? []).map(c => c.name),
    options: (p.options ?? []).map(o => ({
      name: o.title,
      values: (o.values ?? []).map(v => ({ label: v.value, available: true })),
    })),
    variants: (p.variants ?? []).map(variantToUcp),
  };
}

const PRODUCT_FIELDS = "*variants,*categories,*options";

// ── Catalog ────────────────────────────────────────────────────────────────────

export async function searchProducts({ query, filters, pagination } = {}) {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  const limit = pagination?.limit ?? 20;
  p.set("limit", String(limit));

  let offset = 0;
  if (pagination?.cursor) {
    try { offset = JSON.parse(Buffer.from(pagination.cursor, "base64url").toString()).offset; } catch {}
  }
  p.set("offset", String(offset));
  p.set("fields", PRODUCT_FIELDS);

  const data = await mFetch(`/store/products?${p}`);
  if (!data) return null;

  let products = data.products.map(productToUcp);

  if (filters?.categories?.length) {
    products = products.filter(pr => pr.categories.some(c => filters.categories.includes(c)));
  }
  if (filters?.price?.max != null) {
    products = products.filter(pr => pr.variants.every(v => v.price.amount <= filters.price.max));
  }

  const hasNext = offset + limit < data.count;
  const nextCursor = hasNext
    ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString("base64url")
    : undefined;

  return {
    products,
    pagination: { total_count: data.count, has_next_page: hasNext, ...(nextCursor ? { cursor: nextCursor } : {}) },
  };
}

export async function getProduct(id, selected = []) {
  const data = await mFetch(`/store/products/${id}?fields=${PRODUCT_FIELDS}`);
  if (!data) return null;

  const ucp = productToUcp(data.product);
  if (selected?.length) {
    ucp.variants = ucp.variants.filter(v =>
      selected.every(s => v.options.some(o => o.name === s.name && o.label === s.label))
    );
  }
  return ucp;
}

export async function lookupProducts(ids = []) {
  if (!ecBase()) return null;
  const results = await Promise.all(
    ids.map(id =>
      mFetch(`/store/products/${id}?fields=${PRODUCT_FIELDS}`)
        .then(d => d ? productToUcp(d.product) : null)
        .catch(err => {
          if (/\b404\b/.test(err.message)) return null;
          throw err;
        })
    )
  );
  return results.filter(Boolean);
}

// ── Cart mappers ───────────────────────────────────────────────────────────────

function cartToUcp(cart) {
  const lineItems = (cart.items ?? []).map(item => ({
    id: item.id,
    item: { id: item.variant_id },
    quantity: item.quantity,
  }));
  const subtotal = cart.subtotal ?? 0;
  const total    = cart.total    ?? subtotal;
  const currency = (cart.currency_code ?? "usd").toUpperCase();
  return {
    id: cart.id,
    status: "active",
    line_items: lineItems,
    currency,
    totals: [
      { type: "subtotal", amount: subtotal, currency },
      { type: "total",    amount: total,    currency },
    ],
    continue_url: `${ecBase()}/checkout?cart_id=${cart.id}`,
  };
}

// ── Cart ───────────────────────────────────────────────────────────────────────

/**
 * Returns { ucpCart, medusaId } or null.
 */
export async function createCart(lineItems = []) {
  const items = lineItems
    .filter(li => li.item?.id ?? li.variant_id)
    .map(li => ({ variant_id: li.item?.id ?? li.variant_id, quantity: li.quantity ?? 1 }));

  const data = await mFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  if (!data) return null;
  return { ucpCart: cartToUcp(data.cart), medusaId: data.cart.id };
}

export async function getCart(medusaId) {
  const data = await mFetch(`/store/carts/${medusaId}`);
  return data ? cartToUcp(data.cart) : null;
}

export async function updateCart(medusaId, lineItems = []) {
  const current = await mFetch(`/store/carts/${medusaId}`);
  if (!current) return null;

  for (const item of current.cart.items ?? []) {
    await mFetch(`/store/carts/${medusaId}/line-items/${item.id}`, { method: "DELETE" });
  }

  for (const li of lineItems) {
    const variantId = li.item?.id ?? li.variant_id;
    if (!variantId) continue;
    await mFetch(`/store/carts/${medusaId}/line-items`, {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity: li.quantity ?? 1 }),
    });
  }

  const updated = await mFetch(`/store/carts/${medusaId}`);
  return updated ? cartToUcp(updated.cart) : null;
}

// ── Checkout ───────────────────────────────────────────────────────────────────

/**
 * Creates (or reuses) a Medusa cart for a UCP checkout.
 * Returns the Medusa cart id, or null if Medusa is not configured.
 */
export async function createCheckoutCart(checkout) {
  if (checkout.cart_id) {
    const data = await mFetch(`/store/carts/${checkout.cart_id}`);
    return data?.cart.id ?? null;
  }

  const items = (checkout.line_items ?? [])
    .filter(li => li.variant_id)
    .map(li => ({ variant_id: li.variant_id, quantity: li.quantity ?? 1 }));

  const data = await mFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  return data?.cart.id ?? null;
}

export async function updateCheckoutCart(medusaCartId, updates) {
  const body = {};
  if (updates.email) body.email = updates.email;
  if (updates.shipping_address) body.shipping_address = updates.shipping_address;

  const data = await mFetch(`/store/carts/${medusaCartId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return !!data;
}

/**
 * Medusa v2 の cart complete 前に必要な準備を行う:
 *   1. 配送方法が未設定なら最初の利用可能な option を追加
 *   2. payment collection + payment session を初期化（system プロバイダー）
 *
 * いずれかのステップが失敗しても complete 自体は試みる（デモ用の best-effort）。
 */
async function prepareCartForComplete(medusaCartId) {
  // 1. 配送方法の追加
  try {
    const shippingOptions = await mFetch(`/store/shipping-options?cart_id=${medusaCartId}`);
    const firstOption = shippingOptions?.shipping_options?.[0];
    if (firstOption) {
      await mFetch(`/store/carts/${medusaCartId}/shipping-methods`, {
        method: "POST",
        body: JSON.stringify({ option_id: firstOption.id }),
      });
      console.log(`[medusa] shipping method added: ${firstOption.id}`);
    }
  } catch (e) {
    console.warn("[medusa] shipping method setup skipped:", e.message);
  }

  // 2. Payment Collection + Session の初期化
  try {
    const pcData = await mFetch("/store/payment-collections", {
      method: "POST",
      body: JSON.stringify({ cart_id: medusaCartId }),
    });
    const pcId = pcData?.payment_collection?.id;
    if (pcId) {
      await mFetch(`/store/payment-collections/${pcId}/payment-sessions`, {
        method: "POST",
        body: JSON.stringify({ provider_id: "pp_system_default" }),
      });
      console.log(`[medusa] payment session initialized for collection: ${pcId}`);
    }
  } catch (e) {
    console.warn("[medusa] payment session setup skipped:", e.message);
  }
}

export async function completeCheckoutCart(medusaCartId) {
  // Medusa v2 が要求する配送・支払い準備を先に実行
  await prepareCartForComplete(medusaCartId);

  const data = await mFetch(`/store/carts/${medusaCartId}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!data) return null;
  return { orderId: data.order?.id ?? null };
}
