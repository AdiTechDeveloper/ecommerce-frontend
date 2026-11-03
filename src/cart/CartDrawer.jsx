import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const CartPage = lazy(() => import('../pages/CartPage.jsx'));
const DrawerContext = createContext(() => {});

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

// Bade screen par cart side se khulta hai (Blinkit jaisa). Phone par /cart page hi khulta hai.
export function CartDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Page badle to drawer band
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      // Upar koi sheet khuli ho to Escape pehle usi ko band kare
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Link ke onClick mein do: desktop par drawer khulta hai, phone par link apna kaam karta hai
  const openCart = useCallback((e) => {
    if (!isDesktop() || window.location.pathname === '/cart') return;
    e?.preventDefault?.();
    setOpen(true);
  }, []);

  const value = useMemo(() => openCart, [openCart]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      {open && (
        <div className="fixed inset-0 z-30">
          <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside
            role="dialog"
            aria-label="Your cart"
            onClick={(e) => e.target.closest('a') && setOpen(false)}
            className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-slate-50 shadow-2xl"
          >
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
              <button
                onClick={() => setOpen(false)}
                aria-label="Close cart"
                className="grid size-11 place-items-center rounded-full active:bg-slate-100 sm:hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <h2 className="text-xl font-extrabold">My Cart</h2>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <Suspense fallback={<div className="m-4 h-40 animate-pulse rounded-2xl bg-slate-200" />}>
                <CartPage embedded />
              </Suspense>
            </div>
          </aside>
        </div>
      )}
    </DrawerContext.Provider>
  );
}

export const useOpenCart = () => useContext(DrawerContext);