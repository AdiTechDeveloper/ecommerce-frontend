import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../cart/CartContext.jsx';
import { useOpenCart } from '../cart/CartDrawer.jsx';

// Phone: sticky bar at the bottom of a store page. Only shows if the cart belongs to this store.
// Big screens use the cart button in the header (and the side drawer) instead.
export default function CartBar({ slug }) {
  const { store, count, subtotal } = useCart();
  const openCart = useOpenCart();
  if (!count || !store || store.slug !== slug) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      <Link
        to="/cart"
        onClick={openCart}
        className="pointer-events-auto flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-white shadow-lg active:bg-brand-dark"
      >
        <span className="grid leading-tight">
          <span className="text-xs font-medium opacity-90">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          <span className="text-base font-extrabold">{money(subtotal)}</span>
        </span>
        <span className="font-extrabold">View cart</span>
      </Link>
    </div>
  );
}
