// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
  // UMD build for browsers
  {
    input: 'src/index.js',
    output: {
      file: 'dist/air-monitor.umd.js',
      format: 'umd',
      name: 'Monitor', // exposed as `window.Monitor`
      globals: {
        arquero: 'aq',
        'air-monitor-algorithms': 'AirMonitorAlgorithms'
      },
      sourcemap: true
    },
    external: ['arquero', 'air-monitor-algorithms'],
    plugins: [resolve(), commonjs(), terser()]
  },

  // ESM build for modern tooling
  {
    input: 'src/index.js',
    output: {
      file: 'dist/air-monitor.esm.js',
      format: 'es',
      sourcemap: true
    },
    external: ['arquero', 'air-monitor-algorithms'],
    plugins: [resolve(), commonjs(), terser()]
  }
];
