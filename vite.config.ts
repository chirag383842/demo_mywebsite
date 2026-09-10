import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['lucide-react', '@supabase/supabase-js'],
  },
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name ?? '';
          let extType = 'assets/';
          if (/\.(png|jpe?g|svg|webp|avif|gif|ico)$/i.test(info)) {
            extType = 'images/';
          } else if (/\.(woff2?|eot|ttf|otf)$/i.test(info)) {
            extType = 'fonts/';
          }
          return `${extType}[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
