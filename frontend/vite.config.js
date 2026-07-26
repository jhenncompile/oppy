import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * En Render Static a veces el .css del build no se publica (404) aunque el
 * .js si. Sin estilos la app se ve "sin diseno". Inyectamos el CSS en el
 * bundle JS para no depender de ese archivo aparte.
 */
function cssInyectadoEnJs() {
  return {
    name: 'css-inyectado-en-js',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const cssKeys = Object.keys(bundle).filter((k) => k.endsWith('.css'));
      if (cssKeys.length === 0) return;

      let css = '';
      for (const key of cssKeys) {
        const asset = bundle[key];
        css += typeof asset.source === 'string'
          ? asset.source
          : Buffer.from(asset.source).toString('utf8');
        delete bundle[key];
      }

      const entry = Object.values(bundle).find(
        (item) => item.type === 'chunk' && item.isEntry
      );
      if (!entry) return;

      entry.code =
        `(function(){var s=document.createElement('style');s.setAttribute('data-oppy','1');s.textContent=${JSON.stringify(css)};document.head.appendChild(s);})();` +
        entry.code;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), cssInyectadoEnJs()],
  server: {
    port: 5173,
    proxy: {
      // En desarrollo el frontend habla con el backend por el mismo origen,
      // asi que no hace falta configurar CORS ni URLs absolutas.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
