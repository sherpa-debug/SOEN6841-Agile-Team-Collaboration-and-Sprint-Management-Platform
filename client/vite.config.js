import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // A project site on GitHub Pages lives under /<repository>/, so the deploy sets VITE_BASE
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
