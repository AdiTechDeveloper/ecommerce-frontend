import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';

import { money } from './api.js';
import { useAuth } from './auth/AuthContext.jsx';
import { useCart } from './cart/CartContext.jsx';
import { useOpenCart } from './cart/CartDrawer.jsx';
import { CartIcon, ChevronDown, PinIcon } from './components/icons.jsx';
import LocationPrompt from './components/LocationPrompt.jsx';
import LocationSheet from './components/LocationSheet.jsx';
import { openLocationSheet, useLocationState } from './location.js';
import HomePage from './pages/HomePage.jsx';
import { usePincode } from './pincode.js';


// Lazy-loaded pages
const StorePage = lazy(() => import('./pages/StorePage.jsx'));
const CartPage = lazy(() => import('./pages/CartPage.jsx'));
const OrderPage = lazy(() => import('./pages/OrderPage.jsx'));
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'));

function Logo() {
  return (
    // <Link
    //   to="/"
    //   className="shrink-0 text-[34px] font-black leading-none tracking-tight md:text-[40px]"
    // >
    //   {/* <span className="text-ink">vak</span>
    //   <span className="text-brand">aro</span> */}
    // <img src="" alt="" />
    // </Link>
 <Link
  to="/"
  aria-label="Vakaro home"
  className="flex shrink-0 items-center"
>
  <img
    src="/Vakaro Special 1.png"
    alt="Vakaro" 
    className="h-16 w-auto max-w-[250px] object-contain sm:h-14 sm:max-w-[220px] md:h-16 md:max-w-[250px] lg:h-[72px] lg:max-w-[380px]"
  />
</Link>
  );
}

function HeaderCart() {
  const { count, subtotal } = useCart();
  const openCart = useOpenCart();

  return (
    <Link
      to="/cart"
      onClick={openCart}
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={`flex h-12 shrink-0 items-center gap-2.5 rounded-xl px-3.5 font-extrabold md:h-14 md:px-5 ${
        count > 0
          ? 'bg-brand text-white active:bg-brand-dark'
          : 'bg-slate-100 text-slate-600 active:bg-slate-200'
      }`}
    >
      <CartIcon className="size-6 md:size-7" />

      {count > 0 ? (
        <span className="grid text-left text-xs leading-tight md:text-sm">
          <span>
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          <span className="text-[13px] md:text-base">
            {money(subtotal)}
          </span>
        </span>
      ) : (
        <span className="hidden text-base md:inline">My Cart</span>
      )}
    </Link>
  );
}

// Account dropdown
function AccountMenu() {
  const { customer, openLogin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) {
        setOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const icon = (
    <svg
      viewBox="0 0 24 24"
      className="size-6 md:hidden"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );

  if (!customer) {
    return (
      <button
        type="button"
        onClick={() => openLogin()}
        aria-label="Login"
        className="grid h-12 min-w-12 place-items-center rounded-xl px-2 text-lg font-semibold active:bg-slate-100 md:h-14 md:px-4 md:hover:bg-slate-100"
      >
        {icon}
        <span className="hidden md:inline">Login</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Account"
        className="flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl px-2 text-lg font-semibold active:bg-slate-100 md:h-14 md:px-4 md:hover:bg-slate-100"
      >
        {icon}

        <span className="hidden md:inline">Account</span>

        <svg
          viewBox="0 0 24 24"
          className="hidden size-4 md:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-sm text-slate-500">
            Logged in as{' '}
            <span className="font-bold text-ink">
              +91 {customer.mobile}
            </span>
          </p>

          <Link
            to="/orders"
            onClick={() => setOpen(false)}
            className="grid h-12 w-full items-center rounded-xl px-3 font-bold active:bg-slate-100 md:hover:bg-slate-100"
          >
            My orders
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="h-12 w-full rounded-xl px-3 text-left font-bold text-tomato active:bg-red-50 md:hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

// Search stores on home and products inside a store
function SearchBox({
  placeholder = 'Search store name, area or pincode',
  label = 'Search stores',
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

// Location selector: GPS or manually entered pincode
function LocationButton({ variant }) {
  const pincode = usePincode();
  const { loc, status } = useLocationState();

  const area =
    loc && loc.pincode === pincode
      ? [loc.area, loc.city].filter(Boolean).join(', ')
      : '';

  const detecting = status === 'detecting';

  // No location yet and the customer refused / it failed: show a red hint instead of a pincode
  const failed =
    !pincode &&
    !detecting &&
    (status === 'denied' || status === 'error' || status === 'unsupported');

  const title = detecting
    ? 'Finding your location...'
    : pincode
      ? `Delivering to ${pincode}`
      : 'Set your location';

  const sub = detecting
    ? 'Please allow location access'
    : failed
      ? 'Location not allowed. Tap to enter pincode'
      : area || (pincode ? 'Tap to change location' : 'Choose your area');

  const label = `${title}. ${sub}. Change location`;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={openLocationSheet}
        aria-label={label}
        className={`hidden size-14 shrink-0 place-items-center rounded-xl md:grid lg:hidden md:hover:bg-slate-100 ${
          failed ? 'text-tomato' : 'text-brand'
        }`}
      >
        <PinIcon className="size-7" />
      </button>
    );
  }

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={openLocationSheet}
        aria-label={label}
        className="flex w-full items-center gap-2 px-4 pb-2.5 text-left text-sm md:hidden"
      >
        <PinIcon className={`size-5 shrink-0 ${failed ? 'text-tomato' : 'text-brand'}`} />

        <span className="shrink-0 font-extrabold">{title}</span>

        <span
          className={`min-w-0 flex-1 truncate ${
            failed ? 'font-semibold text-tomato' : 'text-slate-500'
          }`}
        >
          {failed ? 'Location not allowed' : area || (!pincode ? sub : '')}
        </span>

        <ChevronDown className="size-4 shrink-0 text-slate-600" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openLocationSheet}
      aria-label={label}
      className="hidden min-w-0 shrink-0 border-l border-slate-200 pl-6 text-left leading-tight lg:block"
    >
      <span className="block text-xl font-extrabold">{title}</span>

      <span
        className={`mt-0.5 flex items-center gap-1 text-sm ${
          failed ? 'font-semibold text-tomato' : 'text-slate-600'
        }`}
      >
        <span className="max-w-60 truncate">{sub}</span>
        <ChevronDown className="size-4 shrink-0" />
      </span>
    </button>
  );
}

function Header({ withSearch, searchProps }) {
  return (
    <header className="border-b border-slate-200 bg-white md:sticky md:top-0 md:z-20 md:shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-x-4 px-4 py-2.5 md:gap-x-6 md:py-4">
        <Logo />

        <LocationButton variant="block" />
        <LocationButton variant="icon" />

        <div className="hidden flex-1 md:block">
          {withSearch && <SearchBox {...searchProps} />}
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-3">
          <AccountMenu />
          <HeaderCart />
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        <LocationButton variant="row" />
      </div>
    </header>
  );
}

export default function App() {
  const { pathname } = useLocation();

  const onStorePage = pathname.startsWith('/s/');
  const withSearch = pathname === '/' || onStorePage;

  const searchProps = onStorePage
    ? {
        placeholder: 'Search products in this store',
        label: 'Search products',
      }
    : {};

  return (
    <>
      <Header
        withSearch={withSearch}
        searchProps={searchProps}
      />

      {/* Mobile search bar */}
      {withSearch && (
        <div className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 py-2 md:hidden">
          <SearchBox {...searchProps} />
        </div>
      )}

      <main
        className={
          onStorePage
            ? ''
            : 'mx-auto max-w-7xl px-4 pb-16 pt-5'
        }
      >
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/order/:orderNo" element={<OrderPage />} />
            <Route path="/s/:slug" element={<StorePage />} />
          

            <Route
              path="*"
              element={
                <div className="grid justify-items-center gap-3 py-12 text-center">
                  <h2 className="text-lg font-bold">
                    Page not found
                  </h2>

                  <Link
                    className="rounded-xl bg-brand px-5 py-3 font-bold text-white"
                    to="/"
                  >
                    Go to home
                  </Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>

      <LocationPrompt />
      <LocationSheet />
    </>
  );
}