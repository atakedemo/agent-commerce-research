#!/usr/bin/env node
/**
 * Standalone CLI demo — verifies b-mcp-server connectivity without a web server.
 * Run: node src/demo.js
 */
import { createMcpClient } from "./mcp-client.js";
import { runShoppingFlow } from "./shopping-flow.js";

const ICONS = { ok: "✅", fail: "❌" };

async function main() {
  console.log("=== UCP Shopping Agent — 疎通確認デモ ===\n");
  console.log("b-mcp-server に接続中...");

  const client = await createMcpClient();
  console.log("接続成功\n");

  try {
    const steps = await runShoppingFlow(client);

    for (const [i, step] of steps.entries()) {
      const icon = ICONS[step.ok ? "ok" : "fail"];
      console.log(`${icon} Step ${i + 1}: ${step.name}  [${step.tool}]`);
      if (!step.ok) {
        console.log("   エラー:", JSON.stringify(step.data, null, 2));
        break;
      }
      // Show key fields from response
      const d = step.data;
      if (d.products)       console.log(`   商品数: ${d.products.length}件`);
      if (d.product?.title) console.log(`   商品名: ${d.product.title}`);
      if (d.id)             console.log(`   ID: ${d.id}`);
      if (d.status)         console.log(`   Status: ${d.status}`);
      if (d.totals)         console.log(`   小計: ${d.totals.find(t => t.type === "subtotal")?.amount ?? "-"} USD`);
    }

    const allOk = steps.every((s) => s.ok);
    console.log(`\n${allOk ? "✅ 全ステップ成功" : "❌ 一部失敗"} — ${steps.length} / 6 ステップ完了`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
