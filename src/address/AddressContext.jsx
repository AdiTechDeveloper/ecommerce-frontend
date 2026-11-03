import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createAddress, deleteAddress, getAddresses, updateAddress } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Logged-in customer ke saved addresses + jo address abhi chuna hua hai.
// Chuna hua address ki id localStorage mein rehti hai (sirf id, poora address nahi).
const SEL_KEY = 'vakaro_address_sel_v1';
const AddressContext = createContext(null);

const readSel = () => {
  try {
    return Number(localStorage.getItem(SEL_KEY)) || null;
  } catch (e) {
    return null;
  }
};
const writeSel = (id) => {
  try {
    if (id) localStorage.setItem(SEL_KEY, String(id));
    else localStorage.removeItem(SEL_KEY);
  } catch (e) {
    /* ignore */
  }
};

export function AddressProvider({ children }) {
  const { customer } = useAuth();
  const customerId = customer?.id ?? null;

  const [list, setList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(readSel);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAddresses();
      setList(res.data || []);
      setLoaded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Login / logout par list badalti hai
  useEffect(() => {
    if (!customerId) {
      setList([]);
      setLoaded(false);
      setError('');
      writeSel(null);
      setSelectedId(null);
      return;
    }
    reload();
  }, [customerId, reload]);

  // Chuna hua address: jo select hai, warna default, warna pehla
  const selected = useMemo(
    () => list.find((a) => a.id === selectedId) || list.find((a) => a.is_default) || list[0] || null,
    [list, selectedId]
  );

  const select = useCallback((id) => {
    writeSel(id);
    setSelectedId(id);
  }, []);

  const add = useCallback(
    async (data) => {
      const res = await createAddress(data);
      await reload();
      select(res.data.id);
      return res.data;
    },
    [reload, select]
  );

  const update = useCallback(
    async (id, data) => {
      const res = await updateAddress(id, data);
      await reload();
      return res.data;
    },
    [reload]
  );

  const remove = useCallback(
    async (id) => {
      await deleteAddress(id);
      if (selectedId === id) select(null);
      await reload();
    },
    [reload, select, selectedId]
  );

  const value = useMemo(
    () => ({ list, loaded, loading, error, selected, select, add, update, remove, reload }),
    [list, loaded, loading, error, selected, select, add, update, remove, reload]
  );

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddresses must be used inside <AddressProvider>');
  return ctx;
}