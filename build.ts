// Bun has no node:sqlite; @matter picks bun:sqlite at runtime, so stub the unused Node import.
// BUN_TARGET (e.g. bun-linux-x64-musl) cross-compiles; BUN_OUTFILE sets the output name (default: best-lights-selector).
const target = process.env.BUN_TARGET;
const outfile = process.env.BUN_OUTFILE ?? 'best-lights-selector';
const r = await Bun.build({
  entrypoints: ['src/index.ts'],
  compile: target ? { target: target as Bun.Build.CompileTarget, outfile } : { outfile },
  plugins: [{
    name: 'stub-node-sqlite',
    setup(b) {
      b.onResolve({ filter: /^node:sqlite$/ }, () => ({ path: 'node-sqlite-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export class DatabaseSync {}', loader: 'js' }));
    },
  }],
});
if (!r.success) { console.error(r.logs); process.exit(1); }
