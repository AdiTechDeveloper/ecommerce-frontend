import { qtyLabel } from '../api.js';

// Green pill: [ - ] qty [ + ]. Going below the minimum calls onChange(0) = remove.
// Height 44px (thumb ke liye). className mein w-full do to dono buttons stretch hote hain.
// compact = sirf number dikhao (card mein, jahan "/kg" price ke saath likha hota hai).
export default function QtyStepper({ qty, unit, step, max, onChange, compact = false, className = '' }) {
  const canAdd = qty + step <= max + 1e-9;
  const btn = `grid h-full flex-1 place-items-center text-xl font-bold active:bg-brand-dark ${
    compact ? 'min-w-8 px-0' : 'min-w-9 px-3'
  }`;

  return (
    <div
      className={`inline-flex h-11 items-center overflow-hidden rounded-lg bg-brand text-white ${className}`}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(qty - step)}
        className={btn}
      >
        −
      </button>
      <span className="px-1 text-center text-sm font-extrabold" aria-live="polite">
        {compact ? String(Number(qty)) : qtyLabel(qty, unit)}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canAdd}
        onClick={() => onChange(qty + step)}
        className={`${btn} disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}
