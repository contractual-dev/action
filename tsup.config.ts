import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/main.ts' },
  format: ['cjs'],
  outDir: 'dist',
  target: 'node20',
  // Bundle everything into a single file (GitHub Actions requirement)
  noExternal: [/.*/],
  clean: true,
  // Don't split chunks - single file output
  splitting: false,
  // Source maps for debugging
  sourcemap: true,
  // Tree shake unused code
  treeshake: true,
  // Output as .js not .cjs for GitHub Actions compatibility
  outExtension: () => ({ js: '.js' }),
  // Add shims for ESM/CJS interop
  shims: true,
  // Use esbuild's CJS output directly without tsup's interop wrapper
  esbuildOptions(options) {
    options.mainFields = ['module', 'main'];
  },
});
