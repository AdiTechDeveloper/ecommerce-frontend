import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { clock, getCategories, getProducts, getStore } from '../api.js';
import { useCart } from '../cart/CartContext.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import CartBar from '../components/CartBar.jsx';
import { useOpenCart } from '../cart/CartDrawer.jsx';
import { BackIcon } from '../components/icons.jsx';
import ProductCard from '../components/ProductCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import { usePincode } from '../pincode.js';
import { tintFor } from '../tint.js';

const PAGE_SIZE = 48;

// key={slug} makes sure all state resets when you move from one store to another
export default function StorePageRoute() {
  const { slug } = useParams();
  return <StorePage key={slug} slug={slug} />;
}

function StorePage({ slug }) {
  const navigate = useNavigate();
  const pincode = usePincode();
  const { cart, count, hasOtherStore, addItem, replaceCart, clear, syncStore, syncProducts } = useCart();
  const openCart = useOpenCart();
  const otherStore = hasOtherStore(slug); // cart mein kisi aur store ka saaman hai

  // Product search box is the one in the site header (App.jsx). It writes ?q= into the URL.
  const [params, setParams] = useSearchParams();
  const search = (params.get('q') || '').trim();

  // Mobile pe search bar chhupa rehta hai; icon dabane par khulta hai
  const [showSearch, setShowSearch] = useState(search !== '');
  const toggleSearch = () => {
    if (showSearch) setParams({}, { replace: true }); // band karte waqt search saaf
    setShowSearch((v) => !v);
  };

  // Sticky store bar (row + search) ki height measure karo, rail ke top ke liye
  const [bar, setBar] = useState(null);
  const [barH, setBarH] = useState(73);
  useEffect(() => {
    if (!bar) return undefined;
    const set = () => setBarH(bar.offsetHeight);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [bar]);

  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  const [categoryId, setCategoryId] = useState('');
  const [query, setQuery] = useState(search);

  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [conflict, setConflict] = useState(null); // product waiting for "start a new cart?" answer
  const reqId = useRef(0);
  const sentinel = useRef(null);

  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate('/');
  };

  // Store + categories
  useEffect(() => {
    setLoadingStore(true);
    setError('');
    Promise.all([getStore(slug, pincode), getCategories(slug)])
      .then(([s, c]) => {
        setStore(s.data);
        syncStore(s.data);
        setCategories(c.data.filter((x) => x.product_count > 0));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingStore(false));
  }, [slug, pincode, syncStore]);

  // Wait a moment after typing before searching (no API call on every key)
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadPage = useCallback(
    (page, replace) => {
      const id = ++reqId.current; // ignore slow, outdated responses
      setLoadingProducts(true);
      setProductsError('');
      getProducts(slug, { page, per_page: PAGE_SIZE, category_id: categoryId, search: query })
        .then((res) => {
          if (id !== reqId.current) return;
          setProducts((prev) => (replace ? res.data : [...prev, ...res.data]));
          setMeta(res.meta);
          syncProducts(res.data); // refresh price/stock of items already in the cart
        })
        .catch((e) => id === reqId.current && setProductsError(e.message))
        .finally(() => id === reqId.current && setLoadingProducts(false));
    },
    [slug, categoryId, query, syncProducts]
  );

  // First page again whenever category or search changes
  useEffect(() => {
    setProducts([]);
    setMeta({ current_page: 1, last_page: 1, total: 0 });
    loadPage(1, true);
  }, [loadPage]);

  // Infinite scroll: load the next page when the bottom sentinel comes into view
  const hasMore = meta.current_page < meta.last_page;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loadingProducts || productsError) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadPage(meta.current_page + 1, false);
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingProducts, productsError, meta.current_page, loadPage]);

  const onAdd = (p) => {
    if (hasOtherStore(slug)) {
      setConflict(p);
      return;
    }
    addItem(p, store);
  };

  const retryProducts = () =>
    products.length ? loadPage(meta.current_page + 1, false) : loadPage(1, true);

  if (loadingStore)
    return <div className="grid place-items-center py-24 text-slate-500">Opening store...</div>;

  if (error && !store)
    return (
      <div className="grid justify-items-center gap-3 px-4 py-16 text-center">
        <h2 className="text-lg font-bold">Store not found</h2>
        <p className="text-slate-500">{error}</p>
        <Link className="rounded-xl bg-brand px-5 py-3 font-bold text-white" to="/">
          Browse stores
        </Link>
      </div>
    );

  const activeCategory = categories.find((c) => String(c.id) === String(categoryId));

  return (
    <div className="mx-auto max-w-7xl bg-white" style={{ '--store-bar-h': `${barH}px` }}>
      {/* STICKY: store row (back, name, open/closed, change store).
          Chipakta hai site header / search bar ke neeche. Height ~73px. */}
      <div ref={setBar} className="sticky top-[var(--app-header-h,65px)] z-20 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="grid size-11 shrink-0 place-items-center rounded-full active:bg-slate-100 md:hover:bg-slate-100"
        >
          <BackIcon className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold leading-tight md:text-2xl">{store.name}</h1>
          <p className="truncate text-sm text-slate-500">
            <span className={store.is_open_now ? 'font-bold text-brand' : 'font-bold text-tomato'}>
              {store.is_open_now ? 'Open now' : 'Closed now'}
            </span>
            {store.open_time && store.close_time
              ? `, ${clock(store.open_time)} to ${clock(store.close_time)}`
              : ''}
            {store.address ? ` · ${store.address}` : ''}
          </p>
        </div>
        {/* Search icon: sirf mobile pe (desktop pe header mein search bar hai) */}
        <button
          type="button"
          onClick={toggleSearch}
          aria-label={showSearch ? 'Close search' : 'Search products'}
          aria-expanded={showSearch}
          className={`grid size-10 shrink-0 place-items-center rounded-lg border md:hidden ${
            showSearch ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 active:bg-slate-50'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {showSearch ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </>
            )}
          </svg>
        </button>
        <Link
          to="/"
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold active:bg-slate-50 md:hover:border-brand"
        >
          Change store
        </Link>
      </div>

      {showSearch && (
        <div className="border-b border-slate-100 bg-white px-3 py-2 md:hidden">
          <SearchBox
            autoFocus
            placeholder="Search products in this store"
            label="Search products"
          />
        </div>
      )}
      </div>

      {/* Ye banners normal scroll hote hain (sticky nahi) */}
      {!store.is_open_now && (
        <p className="bg-red-50 px-4 py-2 text-sm text-tomato">
          This store is closed right now.
          {store.open_time ? ` Orders open at ${clock(store.open_time)}.` : ''} You can still browse.
        </p>
      )}

      {store.serves_pincode === false && (
        <p className="bg-amber-100 px-4 py-2 text-sm">
          This store does not deliver to {pincode}, but you can still browse.
        </p>
      )}

      {otherStore && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-amber-100 px-4 py-2.5 text-sm">
          <p className="min-w-0 flex-1">
            Your cart has {count} {count === 1 ? 'item' : 'items'} from{' '}
            <span className="font-bold">{cart.store?.name}</span>. Place that order or clear the cart to shop from
            this store.
          </p>
          <div className="flex shrink-0 gap-2">
            <Link
              to="/cart"
              onClick={openCart}
              className="grid h-11 place-items-center rounded-lg bg-brand px-4 font-bold text-white active:bg-brand-dark"
            >
              View cart
            </Link>
            <button
              onClick={clear}
              className="h-11 rounded-lg border border-slate-300 bg-white px-4 font-bold active:bg-slate-50"
            >
              Clear cart
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Left category rail. Ab sticky store row ke neeche chipakta hai:
            65 + 73 = 138 (phone), 89 + 73 = 162 (md+) */}
        <aside className="no-scrollbar sticky top-[calc(var(--app-header-h,65px)+var(--store-bar-h,73px))] h-[calc(100dvh-var(--app-header-h,65px)-var(--store-bar-h,73px))] w-[84px] shrink-0 overflow-y-auto border-r border-slate-100 bg-white pb-6 md:w-[104px]">
          <RailItem label="All" active={categoryId === ''} onClick={() => setCategoryId('')} all />
          {categories.map((c) => (
            <RailItem
              key={c.id}
              label={c.name}
              image={c.image}
              active={String(c.id) === String(categoryId)}
              onClick={() => setCategoryId(c.id)}
            />
          ))}
        </aside>

        {/* Products */}
        <section className="min-w-0 flex-1 bg-slate-50 p-2.5 pb-28 md:p-5 md:pb-12">
          <div className="flex items-baseline justify-between gap-2 px-1 pb-3">
            <h2 className="truncate text-base font-extrabold md:text-xl">
              {query ? `Results for "${query}"` : activeCategory ? activeCategory.name : 'All items'}
            </h2>
            <span className="shrink-0 text-xs text-slate-500 md:text-sm">
              {meta.total} {meta.total === 1 ? 'item' : 'items'}
            </span>
          </div>

          {products.length === 0 && !loadingProducts && !productsError ? (
            <div className="grid justify-items-center gap-1 py-14 text-center">
              <h3 className="font-bold">Nothing found</h3>
              <p className="text-sm text-slate-500">Try another category or search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={onAdd} />
              ))}

              {loadingProducts &&
                products.length === 0 &&
                Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-200" />
                ))}
            </div>
          )}

          {productsError && (
            <div className="grid justify-items-center gap-2 py-8 text-center">
              <p className="text-sm text-slate-600">{productsError}</p>
              <button
                onClick={retryProducts}
                className="rounded-xl border-2 border-brand px-5 py-2 font-bold text-brand active:bg-brand-soft"
              >
                Try again
              </button>
            </div>
          )}

          {/* Infinite scroll trigger */}
          {hasMore && <div ref={sentinel} className="h-8" aria-hidden="true" />}

          {loadingProducts && products.length > 0 && (
            <p className="py-4 text-center text-sm text-slate-500">Loading more...</p>
          )}

          {!hasMore && !loadingProducts && products.length > 0 && (
            <p className="py-4 text-center text-xs text-slate-400">You have reached the end</p>
          )}
        </section>
      </div>

      <CartBar slug={slug} />

      {/* One cart = one store: ya pehle wala order poora karo, ya cart khaali karo */}
      <BottomSheet open={!!conflict} onClose={() => setConflict(null)} title="Finish your current order first">
        <p className="mt-1 text-sm text-slate-600">
          Your cart has items from <span className="font-bold">{cart.store?.name}</span>. You can order from only one
          store at a time. Place that order, or clear your cart to add this item.
        </p>
        <div className="mt-4 grid gap-2">
          <Link
            to="/cart"
            onClick={(e) => {
              setConflict(null);
              openCart(e);
            }}
            className="grid h-12 place-items-center rounded-xl bg-brand font-bold text-white active:bg-brand-dark"
          >
            View cart and place order
          </Link>
          <button
            onClick={() => {
              replaceCart(conflict, store);
              setConflict(null);
            }}
            className="h-12 rounded-xl border-2 border-tomato font-bold text-tomato active:bg-red-50"
          >
            Clear cart and add this item
          </button>
          <button
            onClick={() => setConflict(null)}
            className="h-12 rounded-xl font-bold text-slate-600 active:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function RailItem({ label, image, active, onClick, all }) {
  // Photo na ho ya khule hi na (broken link) to pehle jaisa pehla akshar dikhao
  const [broken, setBroken] = useState(false);

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-1 border-l-4 px-1 py-3 text-center ${
        active ? 'border-brand bg-brand-soft/60' : 'border-transparent md:hover:bg-slate-50'
      }`}
    >
      <span
        className={`grid size-12 place-items-center overflow-hidden rounded-xl text-lg font-extrabold text-ink/50 md:size-14 ${
          active ? 'ring-2 ring-brand' : ''
        }`}
        style={{ background: all ? '#eef2f0' : tintFor(label) }}
      >
        {all ? (
          <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" />
          </svg>
        ) : image && !broken ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : (
          label.charAt(0)
        )}
      </span>
      <span
        className={`line-clamp-2 text-[11px] leading-tight md:text-xs ${
          active ? 'font-extrabold text-brand-dark' : 'font-medium text-slate-600'
        }`}
      >
        {label}
      </span>
    </button>
  );
}