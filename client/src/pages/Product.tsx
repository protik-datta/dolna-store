import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Minus,
  Plus,
  ShoppingBag,
  Truck,
  ShieldCheck,
  ArrowLeft,
  Check,
  X,
} from "lucide-react";
import { api, catalogQueryOptions, money, imageUrl } from "../lib/api";
import type { Product as P } from "../types";
import { useCart } from "../context/CartContext";
import { useSeo } from "../hooks/useSeo";
import { track } from "../lib/analytics";
import { ProductCard } from "../components/ProductCard";
export default function ProductPage() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const [variant, setVariant] = useState("");
  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const [added, setAdded] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const q = useQuery({
    ...catalogQueryOptions,
    queryKey: ["product", slug],
    queryFn: async () => (await api.get(`/products/${slug}`)).data.data as P,
  });
  const p = q.data;
  const related = useQuery({
    ...catalogQueryOptions,
    queryKey: ["related", p?.collection, p?._id],
    enabled: !!p,
    queryFn: async () =>
      (
        (
          await api.get("/products", {
            params: { collection: p!.collection, limit: 5 },
          })
        ).data.data.items as P[]
      )
        .filter((x) => x._id !== p!._id)
        .slice(0, 4),
  });
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  useEffect(() => {
    if (p) {
      track("ViewContent", {
        content_name: p.name,
        content_ids: [p._id],
        content_type: "product",
        currency: "BDT",
        value: p.price,
      });
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "dolna-product-schema";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description: p.shortDescription || p.description,
        image: p.images.map((i) => i.url),
        sku: p.slug,
        offers: {
          "@type": "Offer",
          priceCurrency: "BDT",
          price: p.price,
          availability: (
            p.variants.length
              ? p.variants.some((v) => v.stock > 0)
              : p.stock > 0
          )
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        },
      });
      document.head.appendChild(script);
      return () => script.remove();
    }
  }, [p]);
  useSeo(
    p ? `${p.name} — দোলনা` : "পণ্য — দোলনা",
    p?.shortDescription || "দোলনার বিস্তারিত",
  );
  if (q.isLoading) return <div className="container section">লোড হচ্ছে...</div>;
  if (!p)
    return (
      <div className="container section empty-state">
        পণ্যটি পাওয়া যায়নি। <Link to="/shop">সব পণ্য দেখুন</Link>
      </div>
    );
  const selected = p.variants.find((v) => v._id === variant);
  const stock = p.variants.length ? selected?.stock : p.stock;
  const canBuy = typeof stock === "number" && stock > 0;
  const price = selected?.price ?? p.price;
  const off =
    p.compareAtPrice && p.compareAtPrice > price
      ? Math.round((1 - price / p.compareAtPrice) * 100)
      : 0;
  const handleAdd = (checkout = false) => {
    add(p, variant || undefined, qty);
    setAdded(true);
    if (checkout) nav("/checkout");
  };
  return (
    <div className="container section product-page">
      <Link to="/shop" className="back-link">
        <ArrowLeft size={16} /> সব দোলনা
      </Link>
      <div className="product-detail-grid">
        <div className="gallery">
          <div className="gallery-main">
            {p.images[image] ? (
              <button
                className="gallery-zoom"
                onClick={() => setLightbox(true)}
                aria-label="ছবি বড় করে দেখুন"
              >
                <img
                  src={imageUrl(p.images[image].url, 1100)}
                  alt={p.name}
                  loading="lazy"
                  width={p.images[image].width || 1100}
                  height={p.images[image].height || 1100}
                />
              </button>
            ) : (
              <div className="image-placeholder large">
                <span>দোলনা</span>
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="gallery-thumbs">
              {p.images.map((im, i) => (
                <button
                  key={im.publicId}
                  className={image === i ? "active" : ""}
                  onClick={() => setImage(i)}
                  aria-label={`ছবি ${i + 1}`}
                >
                  <img src={imageUrl(im.url, 180)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-detail-copy">
          <span className="eyebrow">{p.collection}</span>
          <h1>{p.name}</h1>
          <p className="detail-description">{p.shortDescription}</p>
          <div className="detail-price">
            <strong>{money(price)}</strong>
            {p.compareAtPrice && p.compareAtPrice > price && (
              <>
                <del>{money(p.compareAtPrice)}</del>
                <span className="discount-tag">{off}% ছাড়</span>
              </>
            )}
          </div>
          <div className="stock-line">
            {stock === undefined ? (
              "ভ্যারিয়েন্ট নির্বাচন করুন"
            ) : stock > 0 ? (
              <>
                <span className="stock-dot" />{" "}
                {stock <= 5 ? `মাত্র ${stock}টি বাকি` : "স্টকে আছে"}
              </>
            ) : (
              <span className="out-stock">স্টক শেষ</span>
            )}
          </div>
          {p.variants.length > 0 && (
            <div className="variant-select">
              <label htmlFor="variant">ভ্যারিয়েন্ট নির্বাচন করুন</label>
              <select
                id="variant"
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value);
                  setQty(1);
                }}
              >
                <option value="">একটি অপশন নির্বাচন করুন</option>
                {p.variants.map((v) => (
                  <option value={v._id} key={v._id}>
                    {v.label}
                    {v.stock === 0 ? " — স্টক শেষ" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="qty-line">
            <span>পরিমাণ</span>
            <div className="qty-control">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="কমিয়ে দিন"
              >
                <Minus size={15} />
              </button>
              <b>{qty}</b>
              <button
                onClick={() => setQty(Math.min(stock ?? 0, qty + 1))}
                disabled={!canBuy || qty >= (stock ?? 0)}
                aria-label="বাড়িয়ে দিন"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="product-actions">
            <button
              className="btn btn-dark"
              disabled={!canBuy}
              onClick={() => handleAdd()}
            >
              <ShoppingBag size={17} /> ব্যাগে যোগ করুন
            </button>
            <button
              className="btn btn-outline"
              disabled={!canBuy}
              onClick={() => handleAdd(true)}
            >
              এখনই অর্ডার করুন
            </button>
          </div>
          {added && (
            <p className="success-note">
              <Check size={15} /> ব্যাগে যোগ হয়েছে।{" "}
              <Link to="/cart">ব্যাগ দেখুন</Link>
            </p>
          )}
          <div className="service-notes">
            <div>
              <Truck />
              <span>সারা বাংলাদেশে ডেলিভারি</span>
            </div>
            <div>
              <ShieldCheck />
              <span>ক্যাশ অন ডেলিভারি সুবিধা</span>
            </div>
          </div>
          <div className="detail-text">
            <h3>পণ্যের বিবরণ</h3>
            <p>{p.description || p.shortDescription}</p>
            {p.features.length > 0 && (
              <>
                <h3>বিশেষ বৈশিষ্ট্য</h3>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            )}
            {p.specs.length > 0 && (
              <>
                <h3>স্পেসিফিকেশন</h3>
                <dl>
                  {p.specs.map((s) => (
                    <div key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>
      </div>
      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="পণ্যের ছবি"
          onClick={() => setLightbox(false)}
        >
          <button aria-label="বন্ধ করুন" onClick={() => setLightbox(false)}>
            <X />
          </button>
          <img src={imageUrl(p.images[image].url, 1600)} alt={p.name} />
        </div>
      )}
      {related.data && related.data.length > 0 && (
        <section className="related-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">YOU MAY ALSO LIKE</span>
              <h2>আরও কিছু পছন্দ</h2>
            </div>
          </div>
          <div className="product-grid">
            {related.data.map((item) => (
              <ProductCard key={item._id} product={item} />
            ))}
          </div>
        </section>
      )}
      <div className="mobile-buy">
        <b>{money(price)}</b>
        <button
          className="btn btn-dark"
          disabled={!canBuy}
          onClick={() => handleAdd(true)}
        >
          অর্ডার করুন
        </button>
      </div>
    </div>
  );
}
