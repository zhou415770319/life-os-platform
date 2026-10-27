/**
 * 将 oklch(...) 颜色转成 rgb/rgba，兼容 Chrome/Edge < 111、Safari < 16.4（不支持 oklch）。
 * 覆盖声明值中的 oklch()（含 CSS 变量定义处，如 --color-red-500: oklch(...)）。
 * @type {import('postcss').Plugin}
 */

function oklchToRgb(L, C, H, alpha) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = Math.pow(l_, 3);
  const m = Math.pow(m_, 3);
  const s = Math.pow(s_, 3);
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const to255 = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  const rr = to255(r);
  const gg = to255(g);
  const bb = to255(bl);
  if (alpha >= 1) return `rgb(${rr}, ${gg}, ${bb})`;
  return `rgba(${rr}, ${gg}, ${bb}, ${alpha})`;
}

function convertValue(value) {
  return value.replace(/oklch\(\s*([^)]*?)\)/gi, (match, inner) => {
    try {
      const parts = inner.split('/');
      const tokens = parts[0].trim().split(/\s+/);
      if (tokens.length < 3) return match;
      // 灰阶色 h/c 为 none（任意），按 0 处理；百分比 L 换算为 0-1
      const num = (v, d) => {
        const s = v.trim();
        if (s === 'none') return d;
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : d;
      };
      const lv = tokens[0].endsWith('%') ? num(tokens[0], 0) / 100 : num(tokens[0], 0);
      const cv = num(tokens[1], 0);
      const hv = num(tokens[2], 0);
      let alpha = 1;
      if (parts[1]) {
        const at = parts[1].trim();
        alpha = at.endsWith('%') ? parseFloat(at) / 100 : parseFloat(at);
        if (!Number.isFinite(alpha)) alpha = 1;
      }
      return oklchToRgb(lv, cv, hv, alpha);
    } catch {
      return match;
    }
  });
}

module.exports = () => ({
  postcssPlugin: 'postcss-oklch-to-rgb',
  Once(root) {
    root.walkDecls((decl) => {
      if (decl.value && decl.value.includes('oklch')) {
        decl.value = convertValue(decl.value);
      }
    });
  },
});
module.exports.postcss = true;
