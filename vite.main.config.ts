import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'electron',
        'keytar',
        'active-win',
        'iohook',
        'fs',
        'path',
        'os',
        'crypto',
        'child_process',
        'util',
        '@langchain/langgraph',
        '@langchain/openai',
        '@langchain/core',
        '@supabase/supabase-js'
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
    target: 'node18',
    outDir: '.vite/build',
    emptyOutDir: false, // Don't clear preload.js
  },
});
