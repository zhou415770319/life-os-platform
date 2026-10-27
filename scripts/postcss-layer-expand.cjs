/**
 * 将 Tailwind v4 输出的 @layer 规则展开为普通规则，
 * 让不支持 @layer（Chrome/Edge < 99、Safari < 16.4）的旧浏览器也能正常加载样式。
 * 展开时保持 Tailwind 输出顺序（theme/base/components/utilities），覆盖关系不变。
 * @type {import('postcss').PluginCreator}
 */
module.exports = () => ({
  postcssPlugin: 'postcss-layer-expand',
  Once(root) {
    const walk = (container) => {
      const toReplace = [];
      container.each((node) => {
        if (node.type === 'atrule' && node.name === 'layer') {
          if (node.nodes && node.nodes.length) {
            // 递归展开内部（可能嵌套 @layer 或 @media 内含 @layer）
            walk(node);
            toReplace.push(node);
          } else {
            // @layer a, b, c; 声明语句（无块），直接删除
            node.remove();
          }
        } else if (node.nodes) {
          // 深入 @media / @supports 等容器，处理内部的 @layer
          walk(node);
        }
      });
      toReplace.forEach((node) => {
        node.replaceWith(...node.nodes);
      });
    };
    walk(root);
  },
});
module.exports.postcss = true;
