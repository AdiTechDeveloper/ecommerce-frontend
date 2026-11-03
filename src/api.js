
import { getToken, notifyUnauthorized } from './auth/token.js';

// All public API calls go through this file.
const BASE = import.meta.env.VITE_API_BASE || '/api/public';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, { params, body, headers: extra } = {}) {
  const clean = Object.entries(params || {}).filter(
    ([, value]) => value !== '' && value != null
  );

  const qs = clean.length
    ? '?' + new URLSearchParams(clean).toString()
    : '';

  const token = getToken();

  const headers = {
    Accept: 'application/json',
    ...extra,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;

  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Check your connection and try again.',
      0,
      null
    );
  }

  let data = null;

  try {
    data = await res.json();
  } catch {
    // Empty or non-JSON response.
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      notifyUnauthorized();
    }

    throw new ApiError(
      data?.message || 'Something went wrong. Please try again.',
      res.status,
      data
    );
  }

  return data;
}

// HTTP helpers
const get = (path, params) =>
  request('GET', path, { params });

const post = (path, body) =>
  request('POST', path, { body: body ?? {} });

const put = (path, body) =>
  request('PUT', path, { body: body ?? {} });

const del = (path) =>
  request('DELETE', path);

// Stores
export const getStores = (pincode) =>
  get('/stores', { pincode });

export const getStore = (slug, pincode) =>
  get(`/stores/${slug}`, { pincode });

export const getCategories = (slug) =>
  get(`/stores/${slug}/categories`);

export const getProducts = (slug, params) =>
  get(`/stores/${slug}/products`, params);

// Location and pincode
// GPS coordinates -> pincode, area, city, state
export const reverseGeocode = (lat, lng) =>
  get('/geo/reverse', {
    lat: Number(lat).toFixed(5),
    lng: Number(lng).toFixed(5),
  });

// Typed pincode -> pincode, area, city, state
// Backend may return 404 if the pincode is not found.
export const lookupPincode = (pin) =>
  get('/geo/pincode', { pin });

// Authentication: mobile + OTP
export const sendOtp = (mobile) =>
  post('/auth/send-otp', { mobile });

export const verifyOtp = (mobile, otp) =>
  post('/auth/verify-otp', { mobile, otp });

export const getMe = () =>
  get('/auth/me');

export const logoutApi = () =>
  post('/auth/logout');

// Addresses (login required)
export const getAddresses = () =>
  get('/addresses');

export const createAddress = (data) =>
  post('/addresses', data);

export const updateAddress = (id, data) =>
  put(`/addresses/${id}`, data);

export const deleteAddress = (id) =>
  del(`/addresses/${id}`);

// Orders (login required)
// Idempotency-Key prevents duplicate order creation on retries.
export const createOrder = (body, idempotencyKey) =>
  request('POST', '/orders', {
    body,
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });

export const getOrder = (orderNo) =>
  get(`/orders/${encodeURIComponent(orderNo)}`);

export const getOrders = (page = 1) =>
  get('/orders', { page });

export const cancelOrder = (orderNo) =>
  post(`/orders/${encodeURIComponent(orderNo)}/cancel`);

// Currency formatter
export const money = (n) =>
  n == null
    ? ''
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(n);

// Quantity formatter
// 2 -> "2", 0.5 + kg -> "0.5 kg"
export const qtyLabel = (qty, unit) =>
  unit === 'kg' ? `${Number(qty)} kg` : String(qty);

// Time formatter
// "09:00:00" -> "9:00 AM"
export const clock = (t) => {
  if (!t) return '';

  const [h, m] = t.split(':').map(Number);
  const hh = h % 12 || 12;

  return `${hh}:${String(m).padStart(2, '0')} ${
    h >= 12 ? 'PM' : 'AM'
  }`;
};
