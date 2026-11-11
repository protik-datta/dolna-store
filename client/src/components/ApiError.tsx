import { errorMessage } from "../lib/api";

export function ApiError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => unknown;
}) {
  return (
    <div className="empty-state" role="alert">
      <p>{errorMessage(error)}</p>
      <button className="btn btn-outline" onClick={() => retry()}>
        আবার চেষ্টা করুন
      </button>
    </div>
  );
}
