import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: Number(process.env.WW_WEB_PORT || 5173), strictPort: true, proxy: {
    '/api': `http://127.0.0.1:${process.env.WW_PORT || 4387}`, '/desktop': { target: `http://127.0.0.1:${process.env.WW_PORT || 4387}`, ws: true },
  } },
})
