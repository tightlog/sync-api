declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TURSO_DATABASE_URL?: string;
      TURSO_AUTH_TOKEN?: string;
      KEY_ESCROW_SECRET?: string;
      D1_DATABASE?: string;
    }
  }
}

export type EnvModule = true;
