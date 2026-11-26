import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getStoreBySlug,
  getStoreProductBySlug,
  listStoreOrdersForAdmin,
  listStoreProductsByIds,
} from "../db/stores.js";
import { requireAdmin } from "../middleware/auth.js";
import { runCalculator, CalculatorBridgeError } from "../services/calculatorBridge.js";
import { getDdpMarketByKey } from "../services/ddpMarkets.js";

const ACADEMIC_STORE_SLUG = "school-academic-supplies";

function handleRouteError(reply: any, error: unknown, fallback = "Request failed") {
  if (error instanceof CalculatorBridgeError) {
    reply.code(502).send({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  reply.code(400).send({ error: message || fallback });
}

export async function registerMarketplaceEconomicsRoutes(app: FastifyInstance) {
  // Local breakeven (school_local.py): blended contribution + 503 units/mo breakeven.
  app.get("/store/breakeven", async (_request, reply) => {
    try {
      const result = await runCalculator("local", { fixed: 20000 });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run local breakeven calculator.");
    }
  });

  // R0 dropship loop (school_dropship.py): per-order margin math for one product.
  app.get("/store/dropship", async (request, reply) => {
    try {
      const params = request.query as Record<string, string | undefined>;
      const productSlug = params.product;
      let retail = Number(params.retail);
      let wholesale = Number(params.wholesale);
      let courier = Number(params.courier);

      if (productSlug) {
        const store = await getStoreBySlug(ACADEMIC_STORE_SLUG);
        if (!store) {
          reply.code(404).send({ error: "Academic store not found." });
          return;
        }
        const product = await getStoreProductBySlug(store.id, productSlug);
        if (!product) {
          reply.code(404).send({ error: `Product ${productSlug} not found.` });
          return;
        }
        retail = product.price_cents / 100;
        wholesale = product.source_cost_cents / 100;
        courier = product.courier_cents / 100;
      }

      if (!retail || !wholesale) {
        reply.code(400).send({
          error: "Provide ?product=<slug> or ?retail=&wholesale= (courier optional).",
        });
        return;
      }

      const result = await runCalculator("dropship", { retail, wholesale, courier });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run dropship calculator.");
    }
  });

  // Borderless DDP (school_ddp.py): per-market landed cost + loss-lane flag.
  app.get("/store/ddp", async (request, reply) => {
    try {
      const params = request.query as Record<string, string | undefined>;
      const productSlug = params.product;
      let source = Number(params.source);
      let pack = Number(params.pack);
      let retail = Number(params.retail);
      let packc = Number(params.packc ?? 18);

      const storeSlug = params.store ?? ACADEMIC_STORE_SLUG;
      if (productSlug) {
        const store = await getStoreBySlug(storeSlug);
        if (!store) {
          reply.code(404).send({ error: `Store ${storeSlug} not found.` });
          return;
        }
        const product = await getStoreProductBySlug(store.id, productSlug);
        if (!product) {
          reply.code(404).send({ error: `Product ${productSlug} not found.` });
          return;
        }
        const attrs = product.attributes_json as Record<string, unknown>;
        const packKg = Number(attrs.pack_kg ?? 0);
        const isExport = attrs.export === true || attrs.export === 1 || attrs.export === "true";
        if (!isExport) {
          // Domestic-only line: no cross-border DDP lane.
          reply.send({
            domestic: true,
            store: { slug: store.slug, name: store.name },
            product: {
              slug: product.slug,
              title: product.title,
              priceCents: product.price_cents,
              sourceCostCents: product.source_cost_cents,
              courierCents: product.courier_cents,
            },
            note: "Local product — delivered domestically, no duties or freight.",
            source: "school_ddp.py (domestic)",
          });
          return;
        }
        // source_cost_cents is per-unit (source*pack); recover R/kg for the calculator.
        source = (product.source_cost_cents / 100) / packKg;
        pack = packKg || 0.4;
        retail = product.price_cents / 100;
        packc = Number(attrs.pack_cost ?? 1800) / 100;
      }

      if (!source || !retail || !pack) {
        reply.code(400).send({
          error: "Provide ?product=<slug> or ?source=&pack=&retail=.",
        });
        return;
      }

      const result = (await runCalculator("ddp", {
        source,
        pack,
        retail,
        packc,
      })) as {
        markets: Array<{
          market: string;
          landed: number;
          source: number;
          freight: number;
          duty: number;
          lastmile: number;
          margin: number;
          pct: number;
          loss_lane: boolean;
        }>;
        worst_lane: { market: string; landed: number } | null;
      };

      const marketKey = params.market;
      const selected = marketKey
        ? result.markets.filter((m) => {
            const cfg = getDdpMarketByKey(marketKey);
            return cfg ? m.market === cfg.name : false;
          })
        : result.markets;

      reply.send({
        domestic: false,
        source,
        pack,
        retail,
        packc,
        selected: marketKey ? selected[0] ?? null : null,
        markets: selected,
        worst_lane: result.worst_lane,
        priceIncludes: "Delivered price includes all duties & freight (DDP).",
        sourceScript: "school_ddp.py",
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to run DDP calculator.");
    }
  });

  // Analytics SKU cull (school_analytics.py): KEEP/WATCH/CULL + stretch signal.
  app.post("/admin/marketplace/analytics/ingest", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const schema = z.object({
        rows: z.array(
          z.object({
            sku: z.string().min(1),
            units_sold: z.coerce.number().nonnegative(),
            revenue: z.coerce.number().nonnegative(),
            returns: z.coerce.number().nonnegative().default(0),
          })
        ),
      });
      const { rows } = schema.parse(request.body);
      const result = await runCalculator("analytics", { rows });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run SKU-cull analytics.");
    }
  });

  // Delivery-KPI scorecard (school_pilot.py targets).
  app.post("/admin/marketplace/analytics/kpi", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const schema = z.object({
        lead_time_days: z.coerce.number().optional(),
        damage_rate: z.coerce.number().min(0).optional(),
        customs_hrs: z.coerce.number().optional(),
        return_rate: z.coerce.number().min(0).optional(),
        nonpay_rate: z.coerce.number().min(0).optional(),
      });
      const body = schema.parse(request.body ?? {});
      const result = await runCalculator("pilot", { ...body });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run delivery-KPI gate.");
    }
  });

  // Dropship margins over real orders (M2): per-order margin + monthly P&L.
  app.get("/admin/marketplace/orders/margins", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const params = request.query as Record<string, string | undefined>;
      let storeId: string | undefined;
      if (params.store) {
        const store = await getStoreBySlug(params.store);
        storeId = store?.id;
      }
      const orders = await listStoreOrdersForAdmin(storeId);
      const productIds = [...new Set(
        orders
          .flatMap((e) => e.items.map((i) => i.product_id))
          .filter((id): id is string => Boolean(id))
      )];
      const products = await listStoreProductsByIds(productIds);
      const productById = new Map(products.map((p) => [p.id, p]));

      const perOrder: Array<Record<string, unknown>> = [];
      let totalMargin = 0;
      let totalRetail = 0;
      for (const entry of orders) {
        let retail = 0;
        let wholesale = 0;
        let courier = 0;
        let resolvable = true;
        for (const item of entry.items) {
          const product = item.product_id ? productById.get(item.product_id) : undefined;
          if (!product) {
            resolvable = false;
            break;
          }
          retail += item.quantity * (product.price_cents / 100);
          wholesale += item.quantity * (product.source_cost_cents / 100);
          courier += product.courier_cents / 100;
        }
        if (!resolvable) continue;
        const result = (await runCalculator("dropship", {
          retail,
          wholesale,
          courier,
          orders_mo: 1,
        })) as { margin: number; margin_pct: number; gateway_fee: number; buffer_need: number };
        perOrder.push({
          orderId: entry.order.id,
          status: entry.order.status,
          payment_status: entry.order.payment_status,
          items: entry.items.length,
          retail: Math.round(retail * 100) / 100,
          margin: result.margin,
          margin_pct: result.margin_pct,
          gateway_fee: result.gateway_fee,
          courier,
        });
        totalMargin += result.margin;
        totalRetail += retail;
      }

      reply.send({
        per_order: perOrder,
        totals: {
          orders_resolved: perOrder.length,
          total_retail: Math.round(totalRetail * 100) / 100,
          total_margin: Math.round(totalMargin * 100) / 100,
          margin_pct: totalRetail ? Math.round((totalMargin / totalRetail) * 1000) / 10 : 0,
        },
        source: "school_dropship.py",
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to compute order margins.");
    }
  });

  // Pilot economics (school_pilot.py): rooibos landed % + gross margin.
  app.get("/admin/marketplace/pilot", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const result = await runCalculator("pilot", {});
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run pilot calculator.");
    }
  });

  // Compute channel (btc_multistream.py / btc_sa_stress.py) — read-only reporting.
  app.get("/admin/compute/multistream", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const params = request.query as Record<string, string | undefined>;
      const result = await runCalculator("btc", {
        mode: "multistream",
        rate: Number(params.rate ?? 0.75),
        heat_price: Number(params.heat_price ?? 0.3),
        grid_rate: Number(params.grid_rate ?? 6),
        green: params.green === "1" || params.green === "true",
      });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run multi-stream calculator.");
    }
  });

  app.get("/admin/compute/stress", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const result = await runCalculator("btc", {
        mode: "stress",
        btc_down: 0.4,
        btc_down_severe: 0.7,
      });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "Unable to run crisis stress-test.");
    }
  });
}
