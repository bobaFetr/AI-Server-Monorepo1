import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { terminalPlugin } from './src/server/terminal-plugin'

const config = defineConfig(({ command }) => ({
  server: { host: '127.0.0.1' },
  // These packages contain native Node addons and must never be prebundled.
  optimizeDeps: { exclude: ['ssh2', 'cpu-features'] },
  ssr: { external: ['ssh2', 'cpu-features'] },
  plugins: [
    terminalPlugin(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    ...(command === 'build' ? [netlify()] : []),
    tanstackStart(),
    viteReact(),
  ],
}))

export default config
