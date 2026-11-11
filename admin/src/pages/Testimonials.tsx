import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../lib/api";
import { Plus, Trash2, Edit2, X, Star } from "lucide-react";
interface Review {
  _id: string;
  name: string;
  location: string;
  text: string;
  rating: number;
  isPublished: boolean;
  sortOrder: number;
}
const empty = {
  name: "",
  location: "",
  text: "",
  rating: 5,
  isPublished: false,
  sortOrder: 0,
};
export default function Testimonials() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Review | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () =>
      (await api.get("/admin/testimonials")).data.data as Review[],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-reviews"] });
  const save = useMutation({
    mutationFn: () =>
      editing?._id
        ? api.put(`/admin/testimonials/${editing._id}`, form)
        : api.post("/admin/testimonials", form),
    onSuccess: () => {
      refresh();
      setEditing(null);
      setForm(empty);
      setMessage("Review saved successfully.");
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/testimonials/${id}`),
    onSuccess: () => {
      refresh();
      setMessage("Review deleted.");
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <>
      <div className="page-title">
        <div>
          <span className="overline">CUSTOMER VOICES</span>
          <h1>Testimonials</h1>
          <p>Publish customer feedback on your storefront.</p>
        </div>
        <button
          className="primary-btn"
          onClick={() => {
            setError("");
            setEditing({} as Review);
            setForm(empty);
          }}
        >
          <Plus size={17} /> Add review
        </button>
      </div>
      {error && !editing && (
        <div className="notice" role="alert">
          {error}
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Review</th>
                <th>Rating</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r._id}>
                  <td>
                    <b>{r.name}</b>
                    <small className="cell-sub">{r.location}</small>
                  </td>
                  <td className="review-text">{r.text}</td>
                  <td>
                    <span className="rating">
                      <Star size={14} fill="currentColor" />
                      {r.rating}/5
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        r.isPublished
                          ? "status status-delivered"
                          : "status status-pending"
                      }
                    >
                      {r.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => {
                          setError("");
                          setEditing(r);
                          setForm({
                            name: r.name,
                            location: r.location || "",
                            text: r.text,
                            rating: r.rating,
                            isPublished: r.isPublished,
                            sortOrder: r.sortOrder,
                          });
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this testimonial?"))
                            del.mutate(r._id);
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
            <div className="empty-admin">Loading testimonials...</div>
          )}
          {q.isSuccess && !q.data.length && (
            <div className="empty-admin">No testimonials yet.</div>
          )}
        </div>
      </section>
      {editing && (
        <div className="modal-backdrop">
          <form
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review editor"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              save.mutate();
            }}
          >
            <div className="modal-head">
              <h2>{editing._id ? "Edit review" : "New review"}</h2>
              <button type="button" onClick={() => setEditing(null)}>
                <X />
              </button>
            </div>
            <label>
              Name
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Location
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label>
              Review
              <textarea
                required
                minLength={5}
                rows={4}
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </label>
            <label>
              Rating
              <select
                value={form.rating}
                onChange={(e) =>
                  setForm({ ...form, rating: Number(e.target.value) })
                }
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option value={n} key={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) =>
                  setForm({ ...form, isPublished: e.target.checked })
                }
              />{" "}
              Published
            </label>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="primary-btn" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save review"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
