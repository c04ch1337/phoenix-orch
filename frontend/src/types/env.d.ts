/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_FRONTEND_PORT: string;
  // Add other environment variables as needed
}