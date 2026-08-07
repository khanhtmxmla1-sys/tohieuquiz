export const MATHJAX_VERSION = 3 as const;
export const MATHJAX_LOCAL_SRC = '/vendor/mathjax/es5/tex-mml-chtml.js';

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
