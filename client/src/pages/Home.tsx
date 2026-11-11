import { ApiError } from "../components/ApiError";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Truck,
  ShieldCheck,
  Headphones,
  Star,
  Leaf,
  HeartHandshake,
} from "lucide-react";
import { api, catalogQueryOptions, money, imageUrl } from "../lib/api";
import type { Product, Testimonial } from "../types";
import { ProductCard } from "../components/ProductCard";
import { useSeo } from "../hooks/useSeo";
import { initPixel } from "../lib/analytics";
export default function Home() {
  useSeo(
    "দোলনা — ঘরে ফিরুক প্রশান্তি",
    "বাংলাদেশের ঘরের জন্য যত্নে তৈরি প্রিমিয়াম দোলনা, হ্যাঙ্গিং সুইং ও ক্রেডল। ক্যাশ অন ডেলিভারি।",
  );
  const products = useQuery({
    ...catalogQueryOptions,
    queryKey: ["products", "home"],
    queryFn: async () =>
      (await api.get("/products?limit=8&sort=popular")).data.data
        .items as Product[],
  });
  const collections = useQuery({
    ...catalogQueryOptions,
    queryKey: ["collections"],
    queryFn: async () =>
      (await api.get("/products/collections")).data.data as {
        name: string;
        count: number;
      }[],
  });
  const reviews = useQuery({
    ...catalogQueryOptions,
    queryKey: ["testimonials"],
    queryFn: async () =>
      (await api.get("/testimonials")).data.data as Testimonial[],
  });
  const featured = products.data?.[0];
  useEffect(() => {
    initPixel();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "dolna-organization-schema";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "দোলনা",
      url: import.meta.env.VITE_SITE_URL || window.location.origin,
      description: "বাংলাদেশের ঘরের জন্য যত্নে তৈরি দোলনা ও হ্যাঙ্গিং সুইং",
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="pill">
              <span className="dot" /> আপনার ঘরের জন্য, যত্নে তৈরি
            </span>
            <h1>
              একটু দোল, <em>অনেকটা</em>
              <br />
              প্রশান্তি।
            </h1>
            <p>
              প্রতিদিনের ব্যস্ততার মাঝে নিজের জন্য তৈরি করুন ছোট্ট এক টুকরো
              শান্তির জায়গা। নান্দনিক ডিজাইন, মজবুত গড়ন আর আরামের ছোঁয়া।
            </p>
            {featured && (
              <div className="hero-price">
                <span>কালেকশন শুরু</span>
                <b>{money(featured.price)}</b>
                <small>ক্যাশ অন ডেলিভারি সুবিধা</small>
              </div>
            )}
            <div className="hero-actions">
              <Link to="/shop" className="btn btn-dark">
                দোলনা দেখুন <ArrowRight size={17} />
              </Link>
              <a href="#story" className="text-link">
                আমাদের গল্প <ArrowRight size={15} />
              </a>
            </div>
            <div className="hero-note">
              <div className="avatar-stack">
                <span>ন</span>
                <span>স</span>
                <span>আ</span>
              </div>
              <span>
                বিশ্বাসের সাথে <b>সারা বাংলাদেশে</b> ডেলিভারি
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-photo">
              {featured?.images[0] ? (
                <img
                  src={imageUrl(featured.images[0].url, 1100)}
                  alt={featured.name}
                  width={featured.images[0].width || 1100}
                  height={featured.images[0].height || 1100}
                />
              ) : (
                <div className="hero-art">
                  <div className="art-rope" />
                  <div className="art-seat" />
                  <div className="art-leaf leaf-one" />
                  <div className="art-leaf leaf-two" />
                  <span>
                    slow living
                    <br />
                    starts here
                  </span>
                </div>
              )}
            </div>
            <div className="hero-caption">
              <span>THE DOLNA COLLECTION</span>
              <b>আরামের নতুন ঠিকানা</b>
            </div>
            <div className="hero-stamp">
              MADE
              <br />
              WITH
              <br />
              CARE
            </div>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <div className="container trust-grid">
          <div>
            <Truck />
            <span>
              <b>সারা বাংলাদেশে ডেলিভারি</b>
              <small>ঘরে বসেই অর্ডার করুন</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <b>ক্যাশ অন ডেলিভারি</b>
              <small>পণ্য হাতে পেয়ে পেমেন্ট</small>
            </span>
          </div>
          <div>
            <Check />
            <span>
              <b>মানের নিশ্চয়তা</b>
              <small>ফিনিশিং ও গড়নে যত্ন</small>
            </span>
          </div>
          <div>
            <Headphones />
            <span>
              <b>সাপোর্ট সবসময়</b>
              <small>প্রয়োজনে পাশে আছি</small>
            </span>
          </div>
        </div>
      </section>
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">HANDPICKED FOR YOU</span>
            <h2>পছন্দের দোলনা</h2>
            <p>প্রতিটি ডিজাইনে আছে আরাম আর নান্দনিকতার মেলবন্ধন।</p>
          </div>
          <Link to="/shop" className="text-link">
            সবগুলো দেখুন <ArrowRight size={16} />
          </Link>
        </div>
        {products.isError ? (
          <ApiError error={products.error} retry={() => products.refetch()} />
        ) : products.isLoading ? (
          <div className="loading-grid">
            {[1, 2, 3, 4].map((n) => (
              <div className="skeleton" key={n} />
            ))}
          </div>
        ) : products.data?.length ? (
          <div className="product-grid">
            {products.data.slice(0, 4).map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        ) : (
          <div className="empty-state">নতুন কালেকশন খুব শিগগিরই আসছে।</div>
        )}
      </section>
      <section className="collections-section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">FIND YOUR COMFORT</span>
              <h2>আপনার পছন্দের ধরন</h2>
              <p>যে কোণেই রাখুন, তৈরি হোক নিজের মতো একটি মুহূর্ত।</p>
            </div>
          </div>
          {collections.isError && (
            <ApiError
              error={collections.error}
              retry={() => collections.refetch()}
            />
          )}
          <div className="collection-grid">
            {(collections.data || []).map((c, i) => (
              <Link
                to={`/shop?collection=${encodeURIComponent(c.name)}`}
                className={`collection-tile tile-${i % 3}`}
                key={c.name}
              >
                <span>০{i + 1}</span>
                <div>
                  <h3>{c.name}</h3>
                  <small>
                    {c.count}টি ডিজাইন <ArrowRight size={14} />
                  </small>
                </div>
              </Link>
            ))}
            {collections.isSuccess && !collections.data.length && (
              <p className="empty-state">কালেকশন যোগ হলে এখানে দেখা যাবে।</p>
            )}
          </div>
        </div>
      </section>
      <section className="story-section" id="story">
        <div className="container story-grid">
          <div className="story-art">
            <div className="story-circle">
              DOLNA
              <br />
              LIVING
            </div>
            <div className="story-leaf">✳</div>
          </div>
          <div className="story-copy">
            <span className="eyebrow">A LITTLE MORE SLOW</span>
            <h2>
              ঘর শুধু থাকার জায়গা নয়,
              <br />
              <em>ভালো থাকারও জায়গা।</em>
            </h2>
            <p>
              দোলনায় আমরা বিশ্বাস করি, ছোট ছোট আরামের মুহূর্তই জীবনের বড়
              আনন্দ। তাই প্রতিটি পণ্যে গুরুত্ব দিই উপকরণ, কারুকাজ এবং ব্যবহারিক
              স্বাচ্ছন্দ্যে।
            </p>
            <div className="benefit-list">
              <div>
                <Leaf />
                <span>
                  <b>বাছাই করা উপকরণ</b>
                  <small>দীর্ঘদিন ব্যবহারের কথা ভেবে</small>
                </span>
              </div>
              <div>
                <HeartHandshake />
                <span>
                  <b>যত্নে তৈরি ফিনিশিং</b>
                  <small>প্রতিটি খুঁটিনাটিতে নজর</small>
                </span>
              </div>
              <div>
                <ShieldCheck />
                <span>
                  <b>নিরাপত্তাকে গুরুত্ব</b>
                  <small>ব্যবহারের আগে নির্দেশনা মেনে চলুন</small>
                </span>
              </div>
            </div>
            <Link to="/shop" className="btn btn-outline">
              কালেকশন ঘুরে দেখুন <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section container review-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">KIND WORDS</span>
            <h2>ক্রেতাদের ভালোবাসা</h2>
            <p>যারা দোলনাকে জায়গা দিয়েছেন তাদের অভিজ্ঞতা।</p>
          </div>
        </div>
        <div className="review-grid">
          {reviews.isError ? (
            <ApiError error={reviews.error} retry={() => reviews.refetch()} />
          ) : reviews.isLoading ? (
            <p className="empty-state">মতামত লোড হচ্ছে...</p>
          ) : reviews.data?.length ? (
            reviews.data.map((r) => (
              <article className="review-card" key={r._id}>
                <div className="stars">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                </div>
                <p>“{r.text}”</p>
                <b>{r.name}</b>
                <small>{r.location}</small>
              </article>
            ))
          ) : (
            <p className="empty-state">
              ক্রেতাদের মতামত শিগগিরই এখানে প্রকাশিত হবে।
            </p>
          )}
        </div>
      </section>
      <section className="faq-section" id="faq">
        <div className="container faq-grid">
          <div>
            <span className="eyebrow">GOOD TO KNOW</span>
            <h2>আপনার কিছু প্রশ্নের উত্তর</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>কীভাবে অর্ডার করব?</summary>
              <p>
                পছন্দের পণ্য নির্বাচন করে অর্ডার ফর্ম পূরণ করুন। আমাদের টিম
                প্রয়োজনে ফোনে নিশ্চিত করবে।
              </p>
            </details>
            <details>
              <summary>ক্যাশ অন ডেলিভারি আছে?</summary>
              <p>হ্যাঁ, সারা বাংলাদেশে ক্যাশ অন ডেলিভারির সুবিধা রয়েছে।</p>
            </details>
            <details>
              <summary>ডেলিভারি চার্জ কত?</summary>
              <p>ঢাকা ও ঢাকার বাইরের ডেলিভারি চার্জ চেকআউটে দেখানো হবে।</p>
            </details>
            <details>
              <summary>পণ্য ব্যবহারের আগে কী করব?</summary>
              <p>
                ইনস্টলেশন ও ওজন ধারণক্ষমতার নির্দেশনা ভালোভাবে পড়ে নিরাপদভাবে
                ব্যবহার করুন।
              </p>
            </details>
          </div>
        </div>
      </section>
      <section className="closing-cta">
        <div className="container">
          <span className="eyebrow">MAKE ROOM FOR REST</span>
          <h2>
            আপনার ছোট্ট শান্তির
            <br />
            জায়গাটি খুঁজে নিন।
          </h2>
          <Link to="/shop" className="btn btn-light">
            এখনই দেখুন <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
