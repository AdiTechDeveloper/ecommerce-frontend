// Image na ho to naam ke hisaab se ek halka rang (har product ka same rang rehta hai)
const TINTS = ['#e3f1e8', '#fdf0cf', '#fbe4de', '#e1ecf7', '#efe6f5'];

export function tintFor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return TINTS[h % TINTS.length];
}
