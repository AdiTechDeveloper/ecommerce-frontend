import { getStore } from '../api.js';

// "Kya ye store is pincode par deliver karta hai?" Backend se pucha jata hai
// (GET /stores/{slug}?pincode=...). Jawab 2 minute yaad rakhte hain taaki baar baar call na ho.
const TTL = 2 * 60 * 1000;
const cache = new Map(); // "slug|pincode" -> { at, promise }

export function checkPincode(slug, pincode) {
  const key = `${slug}|${pincode}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;

  const promise = getStore(slug, pincode)
    .then((res) => ({ serves: !!res.data?.serves_pincode, store: res.data }))
    .catch((err) => {
      cache.delete(key); // fail hua to agli baar dobara try ho
      throw err;
    });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}