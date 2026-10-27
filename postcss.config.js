/**
 * @type {import('postcss-load-config').Config}
 */
module.exports = {
  plugins: {
    'postcss-import': {},
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    // 旧浏览器兼容：展开 @layer + 转译 oklch（Chrome/Edge < 99 / < 111 不支持）
    './scripts/postcss-layer-expand.cjs': {},
    './scripts/postcss-oklch-to-rgb.cjs': {},
  },
}
