import { createRequire } from "module"

// Read the app version from package.json at build time and expose it to the
// client (NEXT_PUBLIC_*), so the UI can show it without bundling package.json.
const require = createRequire(import.meta.url)
const { version } = require("./package.json")

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
}

export default nextConfig
