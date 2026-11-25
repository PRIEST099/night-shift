import { defineConfig } from 'vite'
import path from 'node:path'

// Builds the dashboard page as an ES module library. The host provides these through its import map.
export default defineConfig({
  root: __dirname,
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: 'es2022',
    lib: { entry: path.resolve(__dirname, 'src/index.tsx'), formats: ['es'], fileName: () => 'index.mjs' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', '@kirocrew/app-sdk', '@kirocrew/app-sdk/ui'],
    },
  },
})
