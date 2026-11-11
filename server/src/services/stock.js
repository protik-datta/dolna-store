import { Product } from "../models/index.js";
export async function changeStock(item, direction) {
  const qty = item.quantity;
  const filter = { _id: item.product };
  const update = { $inc: {} };
  if (item.variantId) {
    filter.variants = {
      $elemMatch: {
        _id: item.variantId,
        ...(direction < 0 ? { stock: { $gte: qty } } : {}),
      },
    };
    update.$inc["variants.$.stock"] = direction * qty;
  } else {
    filter.stock = { $gte: direction < 0 ? qty : 0 };
    update.$inc.stock = direction * qty;
  }
  const result = await Product.updateOne(filter, update);
  return result.modifiedCount === 1;
}
export async function reserveItems(items) {
  const reserved = [];
  for (const item of items) {
    const ok = await changeStock(item, -1);
    if (!ok) {
      for (const done of reserved) await changeStock(done, 1);
      const p = await Product.findById(item.product);
      throw Object.assign(
        new Error(`${p?.name || "পণ্য"}-এর পর্যাপ্ত স্টক নেই।`),
        { status: 409 },
      );
    }
    reserved.push(item);
  }
  return reserved;
}
export async function releaseItems(items) {
  for (const item of items) await changeStock(item, 1);
}
