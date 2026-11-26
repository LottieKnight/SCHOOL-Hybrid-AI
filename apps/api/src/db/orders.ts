import { pool } from "./pool.js";
import { BookRecord } from "./books.js";

export type OrderRecord = {
  id: string;
  user_id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
};

export type OrderItemRecord = {
  id: string;
  order_id: string;
  book_id: string;
  quantity: number;
  unit_price_cents: number;
  created_at: string;
  title?: string;
};

export async function createOrderWithItems(
  userId: string,
  items: { bookId: string; quantity: number }[],
  books: BookRecord[]
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bookMap = new Map(books.map((book) => [book.id, book]));
    let total = 0;
    const orderItems: OrderItemRecord[] = [];

    for (const item of items) {
      const book = bookMap.get(item.bookId);
      if (!book) {
        throw new Error("Book not found");
      }
      const unitPrice = book.is_free ? 0 : book.price_cents || 0;
      total += unitPrice * item.quantity;
      orderItems.push({
        id: "",
        order_id: "",
        book_id: book.id,
        quantity: item.quantity,
        unit_price_cents: unitPrice,
        created_at: "",
        title: book.title,
      });
    }

    const orderResult = await client.query<OrderRecord>(
      "INSERT INTO orders (user_id, status, total_cents, currency) VALUES ($1, $2, $3, $4) RETURNING id, user_id, status, total_cents, currency, created_at",
      [userId, "pending", total, "ZAR"]
    );
    const order = orderResult.rows[0];

    for (const item of orderItems) {
      const itemResult = await client.query<OrderItemRecord>(
        "INSERT INTO order_items (order_id, book_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4) RETURNING id, order_id, book_id, quantity, unit_price_cents, created_at",
        [order.id, item.book_id, item.quantity, item.unit_price_cents]
      );
      item.id = itemResult.rows[0].id;
      item.order_id = itemResult.rows[0].order_id;
      item.created_at = itemResult.rows[0].created_at;
    }

    await client.query("COMMIT");
    return { order, items: orderItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
