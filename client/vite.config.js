import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE is set by the deploy workflow (for example /repo-name/ on GitHub Pages).
// Locally it stays "/", so `npm run dev` works as before.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
