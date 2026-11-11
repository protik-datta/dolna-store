import type { Product } from '../types';
import { money } from './api';

const configuredNumber = String(import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
const internationalNumber = configuredNumber.startsWith('01') ? `88${configuredNumber}` : configuredNumber;

export const WHATSAPP_NUMBER = /^\d{10,15}$/.test(internationalNumber)
  ? internationalNumber
  : '8801615238511';
export const WHATSAPP_DISPLAY_NUMBER = WHATSAPP_NUMBER.startsWith('8801')
  ? WHATSAPP_NUMBER.slice(2)
  : `+${WHATSAPP_NUMBER}`;

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function productUrl(slug: string) {
  let origin = window.location.origin;
  try {
    const configuredSite = new URL(String(import.meta.env.VITE_SITE_URL || origin));
    if (['http:', 'https:'].includes(configuredSite.protocol)) origin = configuredSite.origin;
  } catch {
    // The current storefront is a safe fallback for an invalid site URL.
  }
  return new URL(`/product/${encodeURIComponent(slug)}`, origin).href;
}

export function productWhatsAppMessage(
  product: Product,
  { variantLabel = '', quantity = 1, unitPrice = product.price }: { variantLabel?: string; quantity?: number; unitPrice?: number } = {},
) {
  return [
    'আসসালামু আলাইকুম, আমি এই পণ্যটি অর্ডার করতে চাই।',
    `পণ্য: ${product.name}`,
    ...(variantLabel ? [`ভ্যারিয়েন্ট: ${variantLabel}`] : []),
    `পরিমাণ: ${quantity}`,
    `প্রতি পিস: ${money(unitPrice)}`,
    `পণ্যের মোট মূল্য: ${money(unitPrice * quantity)}`,
    `পণ্যের লিংক: ${productUrl(product.slug)}`,
    'দয়া করে মূল্য, স্টক, পেমেন্ট ও ডেলিভারির বিস্তারিত নিশ্চিত করুন।',
  ].join('\n');
}
