import { money } from '../api.js';
import { stepFor, useCart } from '../cart/CartContext.jsx';
import { tintFor } from '../tint.js';
import { ClockIcon } from './icons.jsx';
import QtyStepper from './QtyStepper.jsx';

// Blinkit-style card: image, small time pill, name, then price on the left and ADD / stepper on the right.
// prep = store.prep_minutes (0 = pill hidden)
export default function ProductCard({ product, onAdd, prep = 0 }) {
  const p = product;
  const { cart, setQty } = useCart();
  const line = cart.items[p.id];
  const perKg = p.price_unit === 'kg';
  const low = p.in_stock && p.online_qty <= 5;
  const imageSrc = p.image_url || p.image;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
      <div
        className={`relative grid aspect-square place-items-center overflow-hidden rounded-lg ${p.in_stock ? '' : 'opacity-50'
          }`}
        style={{ background: tintFor(p.name) }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-5xl font-extrabold text-ink/30">
            {p.name.charAt(0)}
          </span>
        )}
        {p.discount_percent > 0 && (
          <span className="absolute left-0 top-0 grid place-items-center rounded-br-lg bg-[#256fef] px-1.5 py-1 text-center text-[10px] font-extrabold leading-[1.15] text-white">
            <span>{p.discount_percent}%</span>
            <span>OFF</span>
          </span>
        )}
      </div>

      {prep > 0 && (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-700">
          <ClockIcon className="size-3" />
          {prep} MINS
        </span>
      )}

      <h4
        title={p.name}
        className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-tight sm:text-sm sm:leading-tight"
      >
        {p.name}
      </h4>

      <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-extrabold">
            {money(p.price)}
            {perKg && <span className="text-xs font-medium text-slate-500">/kg</span>}
          </div>
          {p.discount_percent > 0 && <div className="text-xs text-slate-400 line-through">{money(p.mrp)}</div>}
        </div>

        <div className="w-full shrink-0 sm:w-[92px]">
          {!p.in_stock ? (
            <span className="grid h-11 place-items-center rounded-lg bg-slate-100 text-center text-xs font-bold text-slate-500 sm:h-9">
              Out of stock
            </span>
          ) : line ? (
            <QtyStepper
              qty={line.qty}
              unit={p.price_unit}
              step={stepFor(p.price_unit)}
              max={p.online_qty}
              compact
              onChange={(q) => setQty(p.id, q)}
              className="w-full justify-between sm:h-9"
            />
          ) : (
            <button
              type="button"
              onClick={() => onAdd(p)}
              className="h-11 w-full rounded-lg border border-brand bg-[#f7fff9] text-sm font-extrabold text-brand active:bg-brand-soft sm:h-9 sm:hover:bg-brand-soft"
            >
              ADD
            </button>
          )}
        </div>
      </div>

      {low && <p className="mt-1.5 text-[11px] font-bold text-tomato">Only {p.online_qty} left</p>}
    </article>
  );
}
