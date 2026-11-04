import { money } from '../api.js';
import { stepFor, useCart, maxFor } from '../cart/CartContext.jsx';
import { tintFor } from '../tint.js';
import { ClockIcon } from './icons.jsx';
import QtyStepper from './QtyStepper.jsx';

// Compact card: square image, name (2 lines), price, ADD / stepper.
export default function ProductCard({ product, onAdd }) {
  const p = product;
  const { cart, setQty } = useCart();
  const line = cart.items[p.id];
  const perKg = p.price_unit === 'kg';
  const low = p.in_stock && p.online_qty <= 5;
  const imageSrc = p.image_url || p.image;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
      <div
        className={`relative grid aspect-square place-items-center overflow-hidden rounded-lg ${
          p.in_stock ? '' : 'opacity-50'
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

      {/* Exactly 2 lines ki fixed height (mobile 16px x 2 = h-8, sm+ 18px x 2 = h-9): lamba naam "..." ke saath kat jayega, teesri line kabhi nahi dikhegi */}
      <h3
        title={p.name}
        className="mt-1.5 line-clamp-2 h-8 overflow-hidden text-xs font-semibold leading-4 sm:h-9 sm:text-sm sm:leading-[18px]"
      >
        {p.name}
      </h3>

      <div className="mt-auto flex flex-col gap-1.5 pt-1.5 sm:gap-2 sm:pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 leading-tight sm:block">
          <div className="text-sm font-extrabold">
            {money(p.price)}
            {perKg && <span className="text-xs font-medium text-slate-500">/kg</span>}
          </div>
          {p.discount_percent > 0 && (
            <div className="text-[11px] text-slate-400 line-through sm:text-xs">{money(p.mrp)}</div>
          )}
        </div>

        <div className="w-full shrink-0 sm:w-[92px]">
          {!p.in_stock ? (
            <span className="grid h-9 place-items-center rounded-lg bg-slate-100 text-center text-xs font-bold text-slate-500 sm:h-9">
              Out of stock
            </span>
          ) : line ? (
            <QtyStepper
              qty={line.qty}
              unit={p.price_unit}
              step={stepFor(p.price_unit)}
              max={maxFor(p)}
              compact
              onChange={(q) => setQty(p.id, q)}
              className="w-full justify-between sm:h-9"
            />
          ) : (
            <button
              type="button"
              onClick={() => onAdd(p)}
              className="h-9 w-full rounded-lg border border-brand bg-[#f7fff9] text-sm font-extrabold text-brand active:bg-brand-soft sm:h-9 sm:hover:bg-brand-soft"
            >
              ADD
            </button>
          )}
        </div>
      </div>

      {low && <p className="mt-1.5 text-[11px] font-bold text-tomato">Only {p.online_qty} left</p>}
      {line && p.max_per_order != null && line.qty >= Number(p.max_per_order) && (
        <p className="mt-1.5 text-[11px] font-bold text-slate-500">Max {p.max_per_order} per order</p>
      )}
    </article>
  );
}