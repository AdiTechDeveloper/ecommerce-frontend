import { useSearchParams } from 'react-router-dom';

// Search stores on home and products inside a store. Writes ?q= into the URL.
export default function SearchBox({
  placeholder = 'Search store name, area or pincode',
  label = 'Search stores',
  autoFocus = false,
}) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';

  const setQ = (value) => {
    setParams(value ? { q: value } : {}, { replace: true });
  };

  return (
    <div className="flex h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 focus-within:border-brand focus-within:bg-white md:h-14 md:rounded-2xl">
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0 text-slate-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500 md:text-lg [&::-webkit-search-cancel-button]:hidden"
      />

      {q && (
        <button
          type="button"
          onClick={() => setQ('')}
          aria-label="Clear search"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-300 text-slate-700 active:bg-slate-400"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}