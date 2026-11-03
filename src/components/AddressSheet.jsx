import { useEffect, useState } from 'react';
import { checkPincode } from '../address/serviceable.js';
import { useAddresses } from '../address/AddressContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import AddressForm from './AddressForm.jsx';
import BottomSheet from './BottomSheet.jsx';

const LABEL_TEXT = { home: 'Home', work: 'Work', other: 'Other' };

export default function AddressSheet({ open, onClose, storeSlug }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Delivery address">
      <SheetBody onClose={onClose} storeSlug={storeSlug} />
    </BottomSheet>
  );
}

// BottomSheet band hone par ye hat jata hai, isliye har baar khulne par state fresh hota hai.
function SheetBody({ onClose, storeSlug }) {
  const { customer } = useAuth();
  const { list, loaded, loading, error, selected, select, add, update, remove, reload } = useAddresses();
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null);
  const [askDelete, setAskDelete] = useState(null);
  const [serves, setServes] = useState({}); // pincode -> true/false

  // Is store ke liye har pincode ka check (bahut se address ek hi pincode ke ho sakte hain)
  useEffect(() => {
    if (!storeSlug) return;
    let cancelled = false;
    [...new Set(list.map((a) => a.pincode))].forEach((pin) => {
      checkPincode(storeSlug, pin)
        .then((r) => !cancelled && setServes((s) => ({ ...s, [pin]: r.serves })))
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [list, storeSlug]);

  const showForm = view === 'form' || (loaded && list.length === 0);

  if (showForm) {
    return (
      <AddressForm
        initial={editing}
        loginMobile={customer?.mobile}
        isFirst={list.length === 0}
        onCancel={list.length > 0 ? () => { setView('list'); setEditing(null); } : onClose}
        onSave={async (data) => {
          if (editing) await update(editing.id, data);
          else await add(data);
          setEditing(null);
          setView('list');
          if (!editing) onClose(); // naya address bana to seedha wahi chun liya, sheet band
        }}
      />
    );
  }

  if (!loaded) {
    return error ? (
      <div className="mt-3 grid gap-3">
        <p className="text-sm font-semibold text-tomato">{error}</p>
        <button onClick={reload} className="h-12 rounded-xl bg-brand font-bold text-white">
          Try again
        </button>
      </div>
    ) : (
      <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100" aria-busy={loading} />
    );
  }

  return (
    <div className="mt-3">
      <ul className="grid gap-2">
        {list.map((a) => {
          const isSel = selected?.id === a.id;
          const ok = serves[a.pincode];
          return (
            <li key={a.id} className={`rounded-xl border-2 p-3 ${isSel ? 'border-brand bg-brand-soft/40' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => {
                  select(a.id);
                  onClose();
                }}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold uppercase">
                    {LABEL_TEXT[a.label] || 'Other'}
                  </span>
                  {a.is_default && <span className="text-[11px] font-bold text-slate-500">Default</span>}
                  {ok === false && <span className="text-[11px] font-bold text-tomato">Store does not deliver here</span>}
                </div>
                <p className="mt-1 text-sm font-bold">
                  {a.name} · {a.mobile}
                </p>
                <p className="text-sm leading-snug text-slate-600">
                  {a.line1}, {a.line2}
                  {a.landmark ? `, ${a.landmark}` : ''}, {a.city} {a.pincode}
                </p>
              </button>

              {askDelete === a.id ? (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="font-semibold">Delete this address?</span>
                  <button
                    onClick={async () => {
                      try {
                        await remove(a.id);
                      } finally {
                        setAskDelete(null);
                      }
                    }}
                    className="h-11 px-3 font-bold text-tomato"
                  >
                    Yes, delete
                  </button>
                  <button onClick={() => setAskDelete(null)} className="h-11 px-3 font-bold">
                    No
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex gap-1 text-sm">
                  <button
                    onClick={() => {
                      setEditing(a);
                      setView('form');
                    }}
                    className="h-11 px-2 font-bold text-brand-dark underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => setAskDelete(a.id)} className="h-11 px-2 font-bold text-slate-500 underline">
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-sm font-semibold text-tomato">{error}</p>}

      <button
        onClick={() => {
          setEditing(null);
          setView('form');
        }}
        className="mt-3 h-12 w-full rounded-xl border-2 border-brand font-extrabold text-brand-dark active:bg-brand-soft"
      >
        + Add new address
      </button>
    </div>
  );
}