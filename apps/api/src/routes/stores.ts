import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import {
  createStoreOrder,
  createStoreQuoteRequest,
  getStoreOrderForAdmin,
  getStoreOrderForUser,
  getStoreProductById,
  getStoreProductBySlug,
  getStoreById,
  getStoreBySlug,
  listStoreOrdersForAdmin,
  listStoreOrdersForUser,
  listStoreProducts,
  listStoreQuoteRequests,
  listStores,
  updateStoreOrderPayment,
  upsertStoreCategory,
  upsertStoreProduct,
  upsertStoreVendor,
  validateStoreCart,
  type StoreCartItemInput,
} from "../db/stores.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createPaymentIntent, fetchStripeCheckoutSession } from "../lib/bookstore-payments.js";
import {
  createPayFastBookstoreCheckoutUrl,
  payfastEnabled,
  verifyPayFastItn,
  type PayFastItnPayload,
} from "../lib/payfast.js";
import { markWebhookEventProcessed } from "../db/wallet.js";

const priceTypeEnum = z.enum(["all", "free", "paid"]);
const fulfillmentTypeEnum = z.enum([
  "LINK_ONLY",
  "FILE_DOWNLOAD",
  "PRINT_ON_DEMAND",
  "SHIP_FROM_SUPPLIER",
  "STOCKED",
  "DROPSHIP",
  "AFFILIATE_LINK",
  "QUOTE_REQUIRED",
]);

const listProductsQuerySchema = z.object({
  category: z.string().trim().min(1).max(200).optional(),
  priceType: priceTypeEnum.optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1),
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1),
  address: z.record(z.unknown()).optional().default({}),
  notes: z.record(z.unknown()).optional().default({}),
});

const checkoutConfirmQuerySchema = z.object({
  provider: z.enum(["stripe", "payfast"]),
  orderId: z.string().uuid(),
  sessionId: z.string().optional(),
});

const quoteRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(99),
      })
    )
    .min(1),
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const vendorSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  tagline: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  accent: z.string().trim().max(40).optional(),
  badge: z.string().trim().max(120).optional(),
  icon_key: z.string().trim().max(80).optional(),
  config_json: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
});

const productSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  slug: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(6000).optional(),
  price_cents: z.coerce.number().int().min(0),
  currency: z.string().trim().max(10).optional(),
  images: z.array(z.string().trim().min(1)).max(50).optional(),
  variants_json: z.array(z.record(z.unknown())).max(100).optional(),
  attributes_json: z.record(z.unknown()).optional(),
  fulfillment_type: fulfillmentTypeEnum.optional(),
  stock_qty: z.coerce.number().int().min(0).nullable().optional(),
  tags: z.array(z.string().trim().min(1)).max(50).optional(),
  is_active: z.boolean().optional(),
});

const categorySchema = z.object({
  slug: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
});

function mapProductForClient(product: {
  id: string;
  store_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  images: string[];
  variants_json: Record<string, unknown>[];
  attributes_json: Record<string, unknown>;
  fulfillment_type: string;
  stock_qty: number | null;
  tags: string[];
  is_active: boolean;
}) {
  return {
    id: product.id,
    storeId: product.store_id,
    categoryId: product.category_id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    priceCents: product.price_cents,
    currency: product.currency,
    images: product.images,
    variants: product.variants_json,
    attributes: product.attributes_json,
    fulfillmentType: product.fulfillment_type,
    stockQty: product.stock_qty,
    tags: product.tags,
    isActive: product.is_active,
  };
}

function mapVendorForClient(vendor: {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  badge: string;
  icon_key: string;
  config_json: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}) {
  return {
    id: vendor.id,
    slug: vendor.slug,
    name: vendor.name,
    tagline: vendor.tagline,
    description: vendor.description,
    accent: vendor.accent,
    badge: vendor.badge,
    iconKey: vendor.icon_key,
    config: vendor.config_json,
    isActive: vendor.is_active,
    sortOrder: vendor.sort_order,
  };
}

function handleRouteError(reply: any, error: unknown, fallback = "Request failed") {
  if (error instanceof z.ZodError) {
    reply.code(400).send({ error: "Invalid input", details: error.flatten() });
    return;
  }
  reply.code(500).send({ error: fallback });
}

function getWebBase() {
  const candidate =
    config.bookstorePublicBaseUrl.trim() ||
    config.corsOrigin.split(",")[0]?.trim() ||
    "http://localhost:3000";
  return candidate.replace(/\/+$/, "");
}

export async function registerStoreRoutes(app: FastifyInstance) {
  app.get("/stores", async (_request, reply) => {
    try {
      const stores = await listStores();
      reply.send({ stores: stores.map(mapVendorForClient) });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load stores.");
    }
  });

  app.get("/stores/:slug", async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store || !store.is_active) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      reply.send({ store: mapVendorForClient(store) });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load store.");
    }
  });

  app.get("/stores/:slug/products", async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store || !store.is_active) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const parsed = listProductsQuerySchema.parse(request.query ?? {});
      const result = await listStoreProducts(store.id, {
        category: parsed.category,
        q: parsed.q,
        priceType: parsed.priceType ?? "all",
        tag: parsed.tag,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });
      reply.send({
        store: mapVendorForClient(store),
        products: result.products.map(mapProductForClient),
        categories: result.categories.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: category.name,
          parentId: category.parent_id,
          sortOrder: category.sort_order,
        })),
        pagination: {
          page: parsed.page ?? 1,
          pageSize: parsed.pageSize ?? 24,
          total: result.total,
        },
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load store catalog.");
    }
  });

  app.get("/stores/:slug/products/:productSlug", async (request, reply) => {
    try {
      const { slug, productSlug } = request.params as { slug?: string; productSlug?: string };
      if (!slug || !productSlug) {
        reply.code(400).send({ error: "Missing store or product slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store || !store.is_active) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const product = await getStoreProductBySlug(store.id, productSlug);
      if (!product) {
        reply.code(404).send({ error: "Product not found" });
        return;
      }
      reply.send({
        store: mapVendorForClient(store),
        product: mapProductForClient(product),
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load product.");
    }
  });

  app.post("/store/cart", async (request, reply) => {
    try {
      const parsed = cartSchema.parse(request.body ?? {});
      const validated = await validateStoreCart(parsed.items as StoreCartItemInput[]);
      reply.send({
        items: validated.items.map((item) => ({
          product: mapProductForClient(item.product),
          store: mapVendorForClient(item.store),
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          line_total_cents: item.line_total_cents,
        })),
        totals: {
          subtotal_cents: validated.subtotal_cents,
          shipping_cents: 0,
          tax_cents: 0,
          total_cents: validated.subtotal_cents,
          currency: validated.currency,
        },
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to validate cart.");
    }
  });

  app.post("/store/checkout", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const parsed = checkoutSchema.parse(request.body ?? {});
      const validated = await validateStoreCart(parsed.items as StoreCartItemInput[]);
      if (!validated.items.length) {
        reply.code(400).send({ error: "Cart is empty or contains unavailable products." });
        return;
      }

      const total = validated.subtotal_cents;
      const freeCheckout = total <= 0;

      const initialOrder = await createStoreOrder(request.user.sub, {
        items: validated.items,
        address_json: parsed.address,
        notes_json: parsed.notes,
        status: freeCheckout ? "paid" : "awaiting_payment",
        payment_status: freeCheckout ? "not_required" : "pending",
        fulfillment_status: freeCheckout ? "ready" : "pending",
        shipping_cents: 0,
        tax_cents: 0,
        payment_provider: freeCheckout ? null : config.bookstorePaymentProvider,
      });

      if (freeCheckout) {
        reply.code(201).send({
          order: initialOrder.order,
          items: initialOrder.items,
          payment: null,
          message: "Free checkout completed.",
        });
        return;
      }

      if (config.paidCheckoutBlocked) {
        reply.code(503).send({
          error:
            "Store checkout is unavailable: no payment provider is configured. Set BOOKSTORE_PAYMENT_PROVIDER=payfast with PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE.",
        });
        return;
      }

      if (config.bookstorePaymentProvider === "payfast" && payfastEnabled()) {
        const webBase = getWebBase();
        const checkoutUrl = createPayFastBookstoreCheckoutUrl({
          orderId: initialOrder.order.id,
          userId: request.user.sub,
          amountZar: initialOrder.order.total_cents / 100,
          itemNames: validated.items.map((item) => item.product.title),
          returnUrl: `${webBase}/checkout?provider=payfast&orderId=${encodeURIComponent(initialOrder.order.id)}`,
          cancelUrl: `${webBase}/checkout?provider=payfast&orderId=${encodeURIComponent(initialOrder.order.id)}&canceled=1`,
          notifyUrl: `${webBase}/api/store/webhooks/payfast`,
        });
        const payfastOrder = await updateStoreOrderPayment(initialOrder.order.id, {
          payment_intent_id: initialOrder.order.id,
          status: "awaiting_payment",
          payment_status: "pending",
        });
        reply.code(201).send({
          order: payfastOrder ?? initialOrder.order,
          items: initialOrder.items,
          payment: {
            provider: "payfast",
            paymentIntentId: initialOrder.order.id,
            clientSecret: null,
            amountCents: initialOrder.order.total_cents,
            currency: initialOrder.order.currency,
            status: "requires_action",
            checkoutUrl,
            checkoutSessionId: initialOrder.order.id,
            providerMetadata: {
              merchantId: config.payfastMerchantId,
              sandbox: Boolean(config.payfastSandbox),
            },
          },
          message: "Order created. Complete payment on PayFast to unlock your items.",
        });
        return;
      }

      const paymentIntent = await createPaymentIntent({
        orderId: initialOrder.order.id,
        amountCents: initialOrder.order.total_cents,
        currency: initialOrder.order.currency,
        metadata: { userId: request.user.sub },
        lineItems: validated.items.map((item) => ({
          name: item.product.title,
          quantity: item.quantity,
          unitAmountCents: item.unit_price_cents,
          description: item.product.description.slice(0, 200),
        })),
      });
      const updatedOrder = await updateStoreOrderPayment(initialOrder.order.id, {
        payment_intent_id: paymentIntent.paymentIntentId,
        status: "awaiting_payment",
        payment_status: "pending",
      });

      reply.code(201).send({
        order: updatedOrder ?? initialOrder.order,
        items: initialOrder.items,
        payment: paymentIntent,
        message: "Order created. Complete payment to unlock your items.",
      });
    } catch (error) {
      handleRouteError(reply, error, "Checkout failed.");
    }
  });

  app.get("/store/checkout/confirm", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const parsed = checkoutConfirmQuerySchema.parse(request.query ?? {});
      const order = await getStoreOrderForUser(parsed.orderId, request.user.sub);
      if (!order) {
        reply.code(404).send({ error: "Order not found" });
        return;
      }

      if (parsed.provider === "stripe") {
        if (!parsed.sessionId) {
          reply.code(400).send({ error: "Missing sessionId" });
          return;
        }
        const session = await fetchStripeCheckoutSession(parsed.sessionId);
        const sessionOrderId =
          session.metadata?.orderId ||
          session.metadata?.order_id ||
          (typeof (session as any).client_reference_id === "string"
            ? (session as any).client_reference_id
            : null);

        if (sessionOrderId && sessionOrderId !== parsed.orderId) {
          reply.code(400).send({ error: "Payment session does not match order." });
          return;
        }

        const paid = session.payment_status === "paid";
        if (paid) {
          await updateStoreOrderPayment(parsed.orderId, {
            payment_intent_id:
              (typeof (session as any).payment_intent === "string"
                ? (session as any).payment_intent
                : order.order.payment_intent_id) ?? parsed.sessionId,
            status: "paid",
            payment_status: "paid",
            fulfillment_status: "ready",
          });
        }
        const refreshed = await getStoreOrderForUser(parsed.orderId, request.user.sub);
        reply.send({
          provider: "stripe",
          payment: {
            sessionId: parsed.sessionId,
            status: session.status,
            paymentStatus: session.payment_status,
            paid,
          },
          ...(refreshed ?? order),
        });
        return;
      }

      if (parsed.provider === "payfast") {
        const refreshed = await getStoreOrderForUser(parsed.orderId, request.user.sub);
        const paid = refreshed?.order.payment_status === "paid";
        reply.send({
          provider: "payfast",
          payment: {
            status: refreshed?.order.status,
            paymentStatus: refreshed?.order.payment_status,
            paid,
          },
          ...(refreshed ?? order),
        });
        return;
      }

      reply.code(400).send({ error: "Unsupported provider" });
    } catch (error) {
      handleRouteError(reply, error, "Unable to confirm checkout.");
    }
  });

  app.post("/store/webhooks/payfast", async (request, reply) => {
    const sourceIp =
      String(request.headers["x-forwarded-for"] || "").split(",")[0]?.trim() ||
      String((request.socket as { remoteAddress?: string }).remoteAddress || "");

    const body = (request.body ?? {}) as PayFastItnPayload;
    const { valid, reason } = await verifyPayFastItn(body, sourceIp);
    if (!valid) {
      app.log.warn({ reason, sourceIp }, "Store PayFast ITN rejected");
      reply.code(400).send({ error: "Invalid PayFast ITN", reason });
      return;
    }

    const orderId = body.m_payment_id?.trim();
    if (!orderId) {
      reply.send({ ok: true, provider: "payfast", handled: false, message: "Missing m_payment_id" });
      return;
    }

    const pfPaymentId = body.pf_payment_id?.trim() || null;
    const eventId = pfPaymentId || orderId;
    const marked = await markWebhookEventProcessed("payfast", eventId);
    if (!marked) {
      reply.send({ ok: true, duplicate: true, provider: "payfast", eventId });
      return;
    }

    const paid = body.payment_status?.toUpperCase() === "COMPLETE";
    if (!paid) {
      await updateStoreOrderPayment(orderId, { status: "failed", payment_status: "failed" });
      reply.send({ ok: true, provider: "payfast", eventId, handled: false, message: "Payment not complete" });
      return;
    }

    const order = await getStoreOrderForAdmin(orderId);
    if (!order) {
      reply.code(404).send({ error: "Order not found" });
      return;
    }

    if (body.custom_str1 && body.custom_str1 !== order.order.user_id) {
      app.log.warn({ orderId, userId: order.order.user_id, custom: body.custom_str1 }, "Store PayFast ITN user mismatch");
      reply.code(400).send({ error: "PayFast ITN user mismatch" });
      return;
    }

    const expectedZar = (order.order.total_cents / 100).toFixed(2);
    const paidZar = Number(body.amount_gross ?? "0").toFixed(2);
    if (paidZar !== expectedZar) {
      app.log.warn({ orderId, expectedZar, paidZar }, "Store PayFast ITN amount mismatch");
      reply.code(400).send({ error: "PayFast ITN amount mismatch" });
      return;
    }

    await updateStoreOrderPayment(orderId, {
      payment_intent_id: pfPaymentId ?? orderId,
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "ready",
    });

    reply.send({ ok: true, provider: "payfast", eventId, handled: true, orderId });
  });

  app.get("/store/orders", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const orders = await listStoreOrdersForUser(request.user.sub);
      const stores = new Map<string, { slug: string; name: string }>();
      for (const entry of orders) {
        for (const item of entry.items) {
          if (item.store_id && !stores.has(item.store_id)) {
            const store = await getStoreById(item.store_id);
            if (store) stores.set(item.store_id, { slug: store.slug, name: store.name });
          }
        }
      }
      reply.send({
        orders: orders.map((entry) => ({
          order: entry.order,
          items: entry.items.map((item) => ({
            ...item,
            ...(item.store_id && stores.get(item.store_id)
              ? {
                  store_slug: stores.get(item.store_id)!.slug,
                  store_name: stores.get(item.store_id)!.name,
                }
              : {}),
          })),
        })),
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load orders.");
    }
  });

  app.post("/stores/:slug/quotes", async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store || !store.is_active) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const parsed = quoteRequestSchema.parse(request.body ?? {});
      const products = await Promise.all(
        parsed.items.map((item) => getStoreProductById(item.productId))
      );
      const items = parsed.items
        .filter((_, index) => products[index] && products[index]!.store_id === store.id)
        .map((item, index) => ({
          productId: item.productId,
          quantity: item.quantity,
          title: products[index]?.title ?? "",
          slug: products[index]?.slug ?? "",
        }));
      if (!items.length) {
        reply.code(400).send({ error: "Quote request has no valid items for this store." });
        return;
      }
      const quote = await createStoreQuoteRequest({
        store_id: store.id,
        user_id: request.user?.sub ?? null,
        items_json: items,
        customer_json: {
          name: parsed.name ?? "",
          email: parsed.email ?? "",
          phone: parsed.phone ?? "",
        },
        notes: parsed.notes ?? "",
      });
      reply.code(201).send({ quote });
    } catch (error) {
      handleRouteError(reply, error, "Unable to submit quote request.");
    }
  });

  app.get("/admin/stores", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const stores = await listStores(true);
      reply.send({ stores: stores.map(mapVendorForClient) });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load stores.");
    }
  });

  app.post("/admin/stores", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const parsed = vendorSchema.parse(request.body ?? {});
      const vendor = await upsertStoreVendor(parsed);
      reply.send({ store: mapVendorForClient(vendor) });
    } catch (error) {
      handleRouteError(reply, error, "Unable to save store.");
    }
  });

  app.get("/admin/stores/:slug/products", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const parsed = listProductsQuerySchema.parse(request.query ?? {});
      const result = await listStoreProducts(store.id, {
        category: parsed.category,
        q: parsed.q,
        priceType: parsed.priceType ?? "all",
        tag: parsed.tag,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });
      reply.send({
        store: mapVendorForClient(store),
        products: result.products.map(mapProductForClient),
        categories: result.categories.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: category.name,
          parentId: category.parent_id,
          sortOrder: category.sort_order,
        })),
        pagination: { page: parsed.page ?? 1, pageSize: parsed.pageSize ?? 24, total: result.total },
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load store catalog.");
    }
  });

  app.post("/admin/stores/:slug/products", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const parsed = productSchema.parse(request.body ?? {});
      const product = await upsertStoreProduct({
        store_id: store.id,
        ...parsed,
      });
      reply.send({ product: mapProductForClient(product) });
    } catch (error) {
      handleRouteError(reply, error, "Unable to save product.");
    }
  });

  app.post("/admin/stores/:slug/categories", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const parsed = categorySchema.parse(request.body ?? {});
      const category = await upsertStoreCategory({
        store_id: store.id,
        ...parsed,
      });
      reply.send({ category });
    } catch (error) {
      handleRouteError(reply, error, "Unable to save category.");
    }
  });

  app.get("/admin/stores/:slug/orders", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const orders = await listStoreOrdersForAdmin(store.id);
      reply.send({
        orders: orders.map((entry) => ({ order: entry.order, items: entry.items })),
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load orders.");
    }
  });

  app.get("/admin/stores/:slug/quotes", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const slug = (request.params as { slug?: string }).slug;
      if (!slug) {
        reply.code(400).send({ error: "Missing store slug" });
        return;
      }
      const store = await getStoreBySlug(slug);
      if (!store) {
        reply.code(404).send({ error: "Store not found" });
        return;
      }
      const quotes = await listStoreQuoteRequests(store.id);
      reply.send({ quotes });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load quotes.");
    }
  });
}
