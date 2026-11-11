import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, money } from "../lib/api";
import type { Product } from "../types";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UploadCloud,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
interface FormState {
  name: string;
  slug: string;
  collection: string;
  shortDescription: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  features: string;
  variants: string;
  specs: string;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: string;
}
const blank: FormState = {
  name: "",
  slug: "",
  collection: "",
  shortDescription: "",
  description: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  features: "",
  variants: "[]",
  specs: "[]",
  isPublished: true,
  isFeatured: false,
  sortOrder: "0",
};
const slugFor = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [files, setFiles] = useState<File[]>([]);
  const [kept, setKept] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["products", "manage", search],
    queryFn: async () =>
      (
        await api.get("/products/manage", {
          params: { search: search || undefined },
        })
      ).data.data as Product[],
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };
  const save = useMutation({
    mutationFn: async () => {
      for (const [label, value] of [
        ["Variants", form.variants],
        ["Specifications", form.specs],
      ]) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value.trim() || "[]");
        } catch {
          throw new Error(`${label} must be valid JSON. Leave [] if unused.`);
        }
        if (!Array.isArray(parsed))
          throw new Error(`${label} must be a JSON array. Leave [] if unused.`);
      }
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append("keepImages", JSON.stringify(kept));
      files.forEach((f) => fd.append("images", f));
      setProgress(0);
      const config = {
        onUploadProgress: (event: { loaded: number; total?: number }) =>
          setProgress(
            Math.round(
              (event.loaded * 100) / (event.total || event.loaded || 1),
            ),
          ),
      };
      return editing?._id
        ? api.put(`/products/${editing._id}`, fd, config)
        : api.post("/products", fd, config);
    },
    onSuccess: (response) => {
      invalidate();
      setEditing(null);
      setForm(blank);
      setFiles([]);
      setKept([]);
      setProgress(0);
      setMessage(
        response.data.data.isPublished
          ? "Product published. It is visible on the website."
          : "Product saved as a draft. It is hidden from the website.",
      );
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (p: Product) =>
      api.patch(`/products/${p._id}/publish`, { isPublished: !p.isPublished }),
    onSuccess: (response) => {
      invalidate();
      setMessage(
        response.data.data.isPublished
          ? "Product published. It is visible on the website."
          : "Product moved to drafts. It is hidden from the website.",
      );
    },
    onError: (e) => setMessage(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      invalidate();
      setMessage("Product deleted.");
    },
    onError: (e) => setMessage(errorMessage(e)),
  });
  const startEdit = (p: Product) => {
    setEditing(p);
    setKept(p.images.map((i) => i.publicId));
    setFiles([]);
    setForm({
      name: p.name,
      slug: p.slug,
      collection: p.collection,
      shortDescription: p.shortDescription || "",
      description: p.description || "",
      price: String(p.price),
      compareAtPrice: String(p.compareAtPrice ?? ""),
      stock: String(p.stock),
      features: (p.features || []).join("\n"),
      variants: JSON.stringify(
        p.variants.map((v) => ({
          _id: v._id,
          label: v.label,
          sku: v.sku || "",
          price: v.price ?? null,
          stock: v.stock,
        })),
        null,
        2,
      ),
      specs: JSON.stringify(p.specs || []),
      isPublished: p.isPublished,
      isFeatured: p.isFeatured,
      sortOrder: String(p.sortOrder ?? 0),
    });
    setMessage("");
    setError("");
  };
  const close = () => {
    if (save.isPending) return;
    setError("");
    setEditing(null);
    setForm(blank);
    setFiles([]);
    setKept([]);
  };
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    const next = files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    setPreviews(next);
    return () => next.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);
  const addFiles = (incoming: File[]) => {
    if (save.isPending) return;
    if (
      incoming.some(
        (f) =>
          f.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    ) {
      setError("Choose JPEG, PNG or WebP images no larger than 5 MB each.");
      return;
    }
    if (kept.length + files.length + incoming.length > 8) {
      setError("A product can have at most eight images.");
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...incoming]);
  };
  const moveKept = (id: string, direction: number) =>
    setKept((prev) => {
      const next = [...prev];
      const index = next.indexOf(id);
      const target = index + direction;
      if (index >= 0 && target >= 0 && target < next.length)
        [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const moveFile = (index: number, direction: number) =>
    setFiles((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target >= 0 && target < next.length)
        [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  return (
    <>
      <div className="page-title">
        <div>
          <span className="overline">CATALOGUE</span>
          <h1>Products</h1>
          <p>Manage your Dolna collections and inventory.</p>
        </div>
        <button
          className="primary-btn"
          onClick={() => {
            close();
            setEditing({} as Product);
          }}
        >
          <Plus size={17} /> Add product
        </button>
      </div>
      {message && (
        <div className="notice">
          {message}
          <button onClick={() => setMessage("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {q.isError && (
        <div className="alert" role="alert">
          {errorMessage(q.error)}{" "}
          <button onClick={() => q.refetch()}>Retry</button>
        </div>
      )}
      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span>{q.data?.length || 0} products</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Collection</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Website visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div className="product-cell">
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt="" />
                      ) : (
                        <span className="no-thumb">D</span>
                      )}
                      <div>
                        <b>{p.name}</b>
                        <small>/{p.slug}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.collection}</td>
                  <td>{money(p.price)}</td>
                  <td>
                    {p.variants.length
                      ? p.variants.reduce((n, v) => n + v.stock, 0)
                      : p.stock}
                  </td>
                  <td>
                    <button
                      className={p.isPublished ? "toggle on" : "toggle"}
                      disabled={toggle.isPending}
                      title={
                        p.isPublished
                          ? "Hide this product from the website"
                          : "Publish this product on the website"
                      }
                      onClick={() => toggle.mutate(p)}
                    >
                      {p.isPublished
                        ? "Live on website"
                        : "Draft — click to publish"}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button title="Edit" onClick={() => startEdit(p)}>
                        <Edit2 size={16} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Delete ${p.name}?`)) del.mutate(p._id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.isLoading && (
            <div className="empty-admin">Loading products...</div>
          )}
          {q.isSuccess && !q.data.length && (
            <div className="empty-admin">
              No products found. Add your first Dolna.
            </div>
          )}
        </div>
      </section>
      {editing && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <form
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Product editor"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              save.mutate();
            }}
          >
            <div className="modal-head">
              <div>
                <span className="overline">PRODUCT EDITOR</span>
                <h2>{editing._id ? "Edit product" : "New product"}</h2>
              </div>
              <button type="button" onClick={close}>
                <X />
              </button>
            </div>
            <fieldset className="editor-fields" disabled={save.isPending}>
              <div className="form-grid">
                <label>
                  Product name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm({
                        ...form,
                        name,
                        slug:
                          !editing._id &&
                          (!form.slug || form.slug === slugFor(form.name))
                            ? slugFor(name)
                            : form.slug,
                      });
                    }}
                  />
                </label>
                <label>
                  URL slug
                  <input
                    required
                    minLength={2}
                    maxLength={140}
                    placeholder="e.g. baby-dolna"
                    title="Use English letters, numbers and hyphens"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value.toLowerCase() })
                    }
                  />
                  <small className="hint">
                    Use a unique URL slug with English letters, numbers and
                    hyphens.
                  </small>
                </label>
                <label>
                  Collection
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.collection}
                    onChange={(e) =>
                      setForm({ ...form, collection: e.target.value })
                    }
                  />
                </label>
                <label>
                  Price (BDT)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </label>
                <label>
                  Compare at price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.compareAtPrice}
                    onChange={(e) =>
                      setForm({ ...form, compareAtPrice: e.target.value })
                    }
                  />
                </label>
                <label>
                  Stock (no variants)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Short description
                  <input
                    maxLength={300}
                    value={form.shortDescription}
                    onChange={(e) =>
                      setForm({ ...form, shortDescription: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Full description
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Features (one per line)
                  <textarea
                    rows={3}
                    value={form.features}
                    onChange={(e) =>
                      setForm({ ...form, features: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Variants JSON (optional; leave [] if unused)
                  <textarea
                    rows={4}
                    value={form.variants}
                    onChange={(e) =>
                      setForm({ ...form, variants: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Specifications JSON (optional; leave [] if unused)
                  <textarea
                    rows={2}
                    value={form.specs}
                    onChange={(e) =>
                      setForm({ ...form, specs: e.target.value })
                    }
                  />
                </label>
                <div className="wide">
                  <label>Product images (JPEG, PNG, WebP · max 5MB each)</label>
                  <label
                    className="upload-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(Array.from(e.dataTransfer.files));
                    }}
                  >
                    <UploadCloud />
                    <span>Choose images or drop files here</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => {
                        addFiles(Array.from(e.target.files || []));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="image-previews">
                    {editing._id &&
                      kept
                        .map((id) =>
                          editing.images.find((i) => i.publicId === id),
                        )
                        .filter((i): i is Product["images"][number] => !!i)
                        .map((i) => (
                          <div key={i.publicId}>
                            <img src={i.url} alt="Existing product" />
                            <button
                              type="button"
                              className="move-up"
                              aria-label="Move image earlier"
                              onClick={() => moveKept(i.publicId, -1)}
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              className="move-down"
                              aria-label="Move image later"
                              onClick={() => moveKept(i.publicId, 1)}
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              type="button"
                              className="remove-image"
                              aria-label="Remove image"
                              onClick={() =>
                                setKept(kept.filter((k) => k !== i.publicId))
                              }
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                    {previews.map((p, i) => (
                      <div key={`${p.name}-${i}`}>
                        <img src={p.url} alt={p.name} />
                        <button
                          type="button"
                          className="move-up"
                          aria-label="Move image earlier"
                          onClick={() => moveFile(i, -1)}
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="move-down"
                          aria-label="Move image later"
                          onClick={() => moveFile(i, 1)}
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="remove-image"
                          aria-label="Remove image"
                          onClick={() =>
                            setFiles(files.filter((_, j) => j !== i))
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <label>
                  Sort order
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: e.target.value })
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) =>
                      setForm({ ...form, isPublished: e.target.checked })
                    }
                  />{" "}
                  Show on website
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) =>
                      setForm({ ...form, isFeatured: e.target.checked })
                    }
                  />{" "}
                  Featured
                </label>
              </div>
              <p className="hint">
                {form.isPublished
                  ? "This product will appear in the website's catalogue."
                  : "This product will be saved as a draft and will not appear on the website."}
              </p>
            </fieldset>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            {save.isPending && (
              <div className="upload-progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={save.isPending}
                onClick={close}
              >
                Cancel
              </button>
              <button className="primary-btn" disabled={save.isPending}>
                {save.isPending
                  ? "Saving..."
                  : form.isPublished
                    ? "Save & publish"
                    : "Save as draft"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
