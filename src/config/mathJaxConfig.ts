export const mathJaxConfig = {
  loader: {
    load: ['input/tex', 'output/chtml', '[tex]/noerrors'],
  },
  tex: {
    packages: { '[+]': ['noerrors'] },
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
  },
  options: {
    ignoreHtmlClass: 'tex2jax_ignore',
    processHtmlClass: 'tex2jax_process',
  },
};
