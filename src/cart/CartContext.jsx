import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// One cart = one store (same rule as the backend: one order = one store).
// Stored in localStorage so it survives refresh. Prices in the cart are only a
// snapshot: the server must re-check price and stock at checkout.
const KEY = 'vakaro_cart_v1';
const EMPTY = { store: null, mode: 'delivery', items: {} };

const round2 = (n) => Math.round(n * 100) / 100;

// Piece items go up by 1, weight items by 0.5 kg
export const stepFor = (unit) => (unit === 'kg' ? 0.5 : 1);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const c = JSON.parse(raw);
    if (!c || typeof c !== 'object' || !c.items || typeof c.items !== 'object') return EMPTY;
    return { ...EMPTY, ...c };
  } catch (e) {
    return EMPTY;
  }
}

const pickStore = (s) => ({
  slug: s.slug,
  name: s.name,
  accepts_delivery: !!s.accepts_delivery,
  accepts_pickup: !!s.accepts_pickup,
  delivery_charge: Number(s.delivery_charge) || 0,
  free_delivery_above: s.free_delivery_above != null ? Number(s.free_delivery_above) : null,
  min_order_amount: Number(s.min_order_amount) || 0,
});


// Ek order mein kitna le sakte hain: stock aur per-order limit mein se jo kam ho
export const maxFor = (p) => {
  const stock = Number(p.online_qty) || 0;
  const lim = p.max_per_order != null ? Number(p.max_per_order) : Infinity;
  return Math.min(stock, lim);
};

const pickItem = (p, qty, addedAt = Date.now()) => ({
  id: p.id,
  name: p.name,
  price: Number(p.price) || 0,
  mrp: p.mrp != null ? Number(p.mrp) : null,
  price_unit: p.price_unit || 'piece',
  max: maxFor(p),
  image: p.image || null,
  qty,
  addedAt,
});

const defaultMode = (s) => (s.accepts_delivery ? 'delivery' : 'pickup');

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (e) {
      /* ignore */
    }
  }, [cart]);

  // Keep multiple tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setCart(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Adds one step. Refuses to silently mix stores: the caller must use replaceCart().
  const addItem = useCallback((product, store) => {
    setCart((c) => {
      const hasItems = Object.keys(c.items).length > 0;
      if (c.store && c.store.slug !== store.slug && hasItems) return c;

      const sameStore = c.store && c.store.slug === store.slug;
      const base = sameStore ? c : { store: pickStore(store), mode: defaultMode(store), items: {} };
      const existing = base.items[product.id];
      const max = maxFor(product);
      const next = Math.min(round2((existing ? existing.qty : 0) + stepFor(product.price_unit)), max);
      if (next <= 0) return c;

      return {
        ...base,
        items: { ...base.items, [product.id]: pickItem(product, next, existing?.addedAt) },
      };
    });
  }, []);

  // Clears the cart and starts a new one with this product
  const replaceCart = useCallback((product, store) => {
    const q = Math.min(stepFor(product.price_unit), maxFor(product));
    if (q <= 0) {
      setCart(EMPTY);
      return;
    }
    setCart({
      store: pickStore(store),
      mode: defaultMode(store),
      items: { [product.id]: pickItem(product, q) },
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setCart((c) => {
      const it = c.items[id];
      if (!it) return c;
      const q = round2(qty);

      if (q <= 0) {
        const rest = { ...c.items };
        delete rest[id];
        return Object.keys(rest).length ? { ...c, items: rest } : EMPTY;
      }
      // Increasing is capped by stock; decreasing is always allowed
      const next = q > it.qty ? Math.min(q, it.max) : q;
      return { ...c, items: { ...c.items, [id]: { ...it, qty: next } } };
    });
  }, []);

  // Order ke waqt server ne bataya ki price / stock badal gaya: cart ko uske hisaab se theek kar do
  const applyServerItems = useCallback((rows) => {
    setCart((c) => {
      const items = { ...c.items };
      for (const r of rows || []) {
        const it = items[r.id];
        if (!it) continue;
        const avail = Number(r.available) || 0;
        if (avail <= 0) {
          delete items[r.id];
          continue;
        }
        items[r.id] = {
          ...it,
          price: Number(r.price) || it.price,
          mrp: r.mrp != null ? Number(r.mrp) : it.mrp,
          max: avail,
          qty: Math.min(it.qty, avail),
        };
      }
      return Object.keys(items).length ? { ...c, items } : EMPTY;
    });
  }, []);

  const clear = useCallback(() => setCart(EMPTY), []);
  const setMode = useCallback((mode) => setCart((c) => ({ ...c, mode })), []);

  // Refresh store charges/timings from the latest API response
  const syncStore = useCallback((store) => {
    setCart((c) => {
      if (!c.store || c.store.slug !== store.slug) return c;
      const next = pickStore(store);
      if (JSON.stringify(next) === JSON.stringify(c.store)) return c;

      let mode = c.mode;
      if (mode === 'delivery' && !next.accepts_delivery && next.accepts_pickup) mode = 'pickup';
      if (mode === 'pickup' && !next.accepts_pickup && next.accepts_delivery) mode = 'delivery';
      return { ...c, store: next, mode };
    });
  }, []);

  // Refresh price/stock of items already in the cart from freshly loaded products
  const syncProducts = useCallback((list) => {
    setCart((c) => {
      let changed = false;
      const items = { ...c.items };
      for (const p of list) {
        const it = items[p.id];
        if (!it) continue;
        const fresh = pickItem(p, it.qty, it.addedAt);
        if (
          fresh.price !== it.price ||
          fresh.mrp !== it.mrp ||
          fresh.max !== it.max ||
          fresh.name !== it.name
        ) {
          items[p.id] = fresh;
          changed = true;
        }
      }
      return changed ? { ...c, items } : c;
    });
  }, []);

  const value = useMemo(() => {
    const store = cart.store;
    const lines = Object.values(cart.items).sort((a, b) => a.addedAt - b.addedAt);

    const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
    const mrpTotal = round2(
      lines.reduce((s, l) => s + (l.mrp && l.mrp > l.price ? l.mrp : l.price) * l.qty, 0)
    );
    const savings = round2(mrpTotal - subtotal);

    const isDelivery = cart.mode === 'delivery';
    const freeAbove = store?.free_delivery_above > 0 ? store.free_delivery_above : null;
    const freeDelivery = isDelivery && freeAbove != null && subtotal >= freeAbove;
    const deliveryFee = isDelivery && store && !freeDelivery ? store.delivery_charge : 0;
    const total = round2(subtotal + deliveryFee);

    // Minimum order and free-delivery targets apply to delivery orders only
    const minShort = isDelivery && store ? Math.max(0, round2(store.min_order_amount - subtotal)) : 0;
    const freeShort = isDelivery && freeAbove != null && !freeDelivery ? round2(freeAbove - subtotal) : 0;
    const hasIssue = lines.some((l) => l.qty > l.max);

    return {
      cart,
      store,
      mode: cart.mode,
      lines,
      count: lines.length,
      subtotal,
      savings,
      freeDelivery,
      deliveryFee,
      total,
      minShort,
      freeShort,
      hasIssue,
      hasOtherStore: (slug) => !!store && store.slug !== slug && lines.length > 0,
      addItem,
      replaceCart,
      setQty,
      setMode,
      clear,
      syncStore,
      syncProducts,
      applyServerItems,
    };
  }, [cart, addItem, replaceCart, setQty, setMode, clear, syncStore, syncProducts, applyServerItems]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}