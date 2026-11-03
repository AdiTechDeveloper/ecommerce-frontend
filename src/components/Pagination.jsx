// Numbered pagination: Prev 1 ... 4 5 6 ... 20 Next
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap-' + p);
    out.push(p);
  });
  return out;
}

const base =
  'grid h-11 min-w-11 place-items-center rounded-lg border px-2 text-sm font-bold transition-colors';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className={`${base} border-slate-200 bg-white px-3 enabled:active:bg-slate-100 enabled:sm:hover:border-brand disabled:text-slate-300`}
      >
        Prev
      </button>

      {/* Phone par sirf "Page 2 of 5", bade screen par numbers */}
      <span className="px-2 text-sm font-semibold text-slate-600 sm:hidden">
        Page {page} of {totalPages}
      </span>

      {pageList(page, totalPages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="hidden px-1 text-slate-400 sm:inline" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={`${base} hidden sm:grid ${
              p === page
                ? 'border-brand bg-brand text-white'
                : 'border-slate-200 bg-white sm:hover:border-brand'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={`${base} border-slate-200 bg-white px-3 enabled:active:bg-slate-100 enabled:sm:hover:border-brand disabled:text-slate-300`}
      >
        Next
      </button>
    </nav>
  );
}