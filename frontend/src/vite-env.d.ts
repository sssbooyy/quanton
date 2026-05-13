/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin, e.g. `https://api.example.com` (no path, no trailing slash). */
  readonly VITE_API_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
