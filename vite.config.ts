import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { localApiPlugin } from './server/vite-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), localApiPlugin()],
  }
})
