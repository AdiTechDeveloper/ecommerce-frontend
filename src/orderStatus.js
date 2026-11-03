// Order ka status: naam aur timeline ke steps (delivery aur pickup ke alag)
export const FINAL = ['delivered', 'cancelled'];

export function statusText(status, mode) {
  const pickup = mode === 'pickup';
  return (
    {
      placed: 'Order placed',
      accepted: 'Accepted by the store',
      preparing: 'Being packed',
      ready: pickup ? 'Ready for pickup' : 'Packed',
      out_for_delivery: 'Out for delivery',
      delivered: pickup ? 'Picked up' : 'Delivered',
      cancelled: 'Cancelled',
    }[status] || status
  );
}

// [{ label, index }]: status kis step par hai (ready delivery mein "packing" wale step par hi rehta hai)
export function timeline(mode) {
  return mode === 'pickup'
    ? { steps: ['Order placed', 'Accepted', 'Ready for pickup', 'Picked up'], at: { placed: 0, accepted: 1, preparing: 1, ready: 2, delivered: 3 } }
    : { steps: ['Order placed', 'Accepted', 'Being packed', 'Out for delivery', 'Delivered'], at: { placed: 0, accepted: 1, preparing: 2, ready: 2, out_for_delivery: 3, delivered: 4 } };
}

export function statusTone(status) {
  if (status === 'cancelled') return 'bg-red-50 text-tomato';
  if (status === 'delivered') return 'bg-slate-100 text-slate-700';
  return 'bg-brand-soft text-brand-dark';
}

export const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';