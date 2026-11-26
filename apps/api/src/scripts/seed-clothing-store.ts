import { pool } from "../db/pool.js";
import {
  upsertStoreVendor,
  upsertStoreCategory,
  upsertStoreProduct,
} from "../db/stores.js";

const STORE_SLUG = "clothing";

const IMAGE_BASE = "/store/clothing/";

type CatalogProduct = {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  image: string;
  category: string;
  tags: string[];
  variants: Record<string, unknown>[];
};

const CATEGORIES = [
  { slug: "tees", name: "Tees", sortOrder: 10 },
  { slug: "hoodies", name: "Hoodies & Sweats", sortOrder: 20 },
  { slug: "jackets", name: "Jackets", sortOrder: 30 },
  { slug: "headwear", name: "Headwear", sortOrder: 40 },
  { slug: "accessories", name: "Accessories", sortOrder: 50 },
];

const PRODUCTS: CatalogProduct[] = [
  {
    slug: "signature-tee",
    title: "Mr J Msibi Signature Tee",
    description:
      "Heavyweight cotton tee with the Mr J Msibi wordmark printed across the chest. Cut for an easy, boxy fit and finished with a ribbed collar that keeps its shape wash after wash.",
    priceCents: 44900,
    image: "product-01.jpeg",
    category: "tees",
    tags: ["signature", "cotton", "new-drop"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Bone White", "Oxblood"] },
      { name: "Size", values: ["S", "M", "L", "XL", "XXL"] },
    ],
  },
  {
    slug: "campus-tee",
    title: "Campus Classic Tee",
    description:
      "The everyday uniform staple. A soft combed-cotton tee with a tonal chest print — quiet enough for class, sharp enough for everything after.",
    priceCents: 39900,
    image: "product-02.jpeg",
    category: "tees",
    tags: ["everyday", "cotton"],
    variants: [
      { name: "Colour", values: ["Bone White", "Ink Black"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
  },
  {
    slug: "gold-logo-tee",
    title: "Gold Foil Logo Tee",
    description:
      "A statement piece finished with metallic gold foil detailing. Limited run — once the drop is gone, it is gone.",
    priceCents: 54900,
    image: "product-03.jpeg",
    category: "tees",
    tags: ["limited", "gold", "premium"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Oxblood"] },
      { name: "Size", values: ["S", "M", "L", "XL", "XXL"] },
    ],
  },
  {
    slug: "oversized-tee",
    title: "Oversized Blank Tee",
    description:
      "Dropped shoulder, generous body, premium hand-feel. The oversized tee built for layering and lounging in equal measure.",
    priceCents: 47900,
    image: "product-04.jpeg",
    category: "tees",
    tags: ["oversized", "cotton"],
    variants: [
      { name: "Colour", values: ["Bone White", "Ink Black", "Sand"] },
      { name: "Size", values: ["M", "L", "XL", "XXL"] },
    ],
  },
  {
    slug: "terracotta-tee",
    title: "Terracotta Heritage Tee",
    description:
      "Warm terracotta tone lifted from the brand palette, printed with the heritage crest. A nod to the tones behind the Mr J Msibi story.",
    priceCents: 49900,
    image: "product-05.jpeg",
    category: "tees",
    tags: ["heritage", "colour-drop", "new-drop"],
    variants: [
      { name: "Colour", values: ["Terracotta", "Ink Black"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
  },
  {
    slug: "hemp-tote",
    title: "Canvas & Hemp Tote",
    description:
      "Heavyweight canvas tote with reinforced handles and an internal slip pocket. Made to carry textbooks, laptops, and everything the day throws at it.",
    priceCents: 34900,
    image: "product-06.jpeg",
    category: "accessories",
    tags: ["accessories", "everyday"],
    variants: [
      { name: "Colour", values: ["Natural", "Ink Black"] },
      { name: "Style", values: ["Standard", "With Zip"] },
    ],
  },
  {
    slug: "cap-classic",
    title: "Classic Caps",
    description:
      "Six-panel structured cap with a curved brim and embroidered wordmark. Adjustable strap-back fit for everyone.",
    priceCents: 32900,
    image: "product-07.jpeg",
    category: "headwear",
    tags: ["headwear", "everyday"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Bone White", "Oxblood"] },
      { name: "Fit", values: ["Adjustable"] },
    ],
  },
  {
    slug: "fleece-sweater",
    title: "Bleached Fleece Sweater",
    description:
      "Midweight brushed fleece with a relaxed fit and the wordmark across the chest. The cold-weather essential that still holds the brand line.",
    priceCents: 69900,
    image: "product-08.jpeg",
    category: "hoodies",
    tags: ["fleece", "winter", "new-drop"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Bone White"] },
      { name: "Size", values: ["S", "M", "L", "XL", "XXL"] },
    ],
  },
  {
    slug: "layered-fleece-set",
    title: "Layered Fleece Set",
    description:
      "Coordinated fleece top and pant set in a tonal wash. Built for the cold months and the dorm-room fit-pic in equal measure.",
    priceCents: 129900,
    image: "product-09.jpeg",
    category: "hoodies",
    tags: ["set", "fleece", "winter"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Sand"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
  },
  {
    slug: "track-top",
    title: "Heritage Track Top",
    description:
      "Full-zip track top in the heritage colourway, with zip chest pockets and the signature branding down the sleeve.",
    priceCents: 79900,
    image: "product-10.jpeg",
    category: "jackets",
    tags: ["track-top", "colour-drop", "new-drop"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Terracotta", "Oxblood"] },
      { name: "Size", values: ["S", "M", "L", "XL", "XXL"] },
    ],
  },
  {
    slug: "puffer-jacket",
    title: "Lightweight Puffer Jacket",
    description:
      "Water-resistant quilted puffer with a packable build. Warmth without the weight — the jacket that carries you through the winter term.",
    priceCents: 149900,
    image: "product-11.jpeg",
    category: "jackets",
    tags: ["outerwear", "winter"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Oxblood"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
  },
  {
    slug: "carryall-bag",
    title: "Structured Carryall",
    description:
      "Structured day-carry with a padded laptop sleeve, zip security pocket, and webbing handles. Travel-sized brand presence.",
    priceCents: 89900,
    image: "product-12.jpeg",
    category: "accessories",
    tags: ["accessories", "travel"],
    variants: [
      { name: "Colour", values: ["Ink Black", "Sand"] },
      { name: "Style", values: ["Standard"] },
    ],
  },
];

async function main() {
  const vendor = await upsertStoreVendor({
    slug: STORE_SLUG,
    name: "Mr J Msibi",
    tagline: "Wear the brand",
    description:
      "Clothing, apparel, and accessories from Mr J Msibi — designed on the Ditshego house palette and built for the student who wears the story.",
    accent: "#C9A24B",
    badge: "Campus threads",
    icon_key: "shirt",
    config_json: {
      paymentProvider: "stub",
      quoteOnly: false,
      fulfillment: "SHIP_FROM_SUPPLIER",
    },
    sort_order: 20,
  });

  for (const category of CATEGORIES) {
    await upsertStoreCategory({
      store_id: vendor.id,
      slug: category.slug,
      name: category.name,
      sort_order: category.sortOrder,
    });
  }

  const categories = await pool.query(
    `SELECT id, slug FROM store_categories WHERE store_id = $1`,
    [vendor.id]
  );
  const categoryIdBySlug = new Map(
    categories.rows.map((row: { id: string; slug: string }) => [row.slug, row.id])
  );

  let inserted = 0;
  for (const product of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(product.category) ?? null;
    await upsertStoreProduct({
      store_id: vendor.id,
      category_id: categoryId,
      slug: product.slug,
      title: product.title,
      description: product.description,
      price_cents: product.priceCents,
      currency: "ZAR",
      images: [`${IMAGE_BASE}${product.image}`],
      variants_json: product.variants,
      attributes_json: { material: "Cotton", source: "Mr J Msibi drop" },
      fulfillment_type: "SHIP_FROM_SUPPLIER",
      stock_qty: 50,
      tags: product.tags,
      is_active: true,
    });
    inserted += 1;
  }

  console.log(`Seeded "${vendor.name}" (${vendor.slug}) with ${inserted} products.`);
}

main()
  .catch((error) => {
    console.error("Clothing store seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
