// Environment variables server-side only

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export const UTILS_BASE_URL = getEnv("UTILS_BASE_URL");

// Langfuse Configuration
export const LANGFUSE_BASE_URL = getEnv("LANGFUSE_BASE_URL");
export const LANGFUSE_PUBLIC_KEY = getEnv("LANGFUSE_PUBLIC_KEY");
export const LANGFUSE_SECRET_KEY = getEnv("LANGFUSE_SECRET_KEY");

// OpenRouter Configuration
export const OPENROUTER_API_KEY = getEnv("OPENROUTER_API_KEY");

// Minio Configuration
export const MINIO_ENDPOINT = getEnv("MINIO_ENDPOINT");
export const MINIO_ACCESS_KEY = getEnv("MINIO_ACCESS_KEY");
export const MINIO_SECRET_KEY = getEnv("MINIO_SECRET_KEY");
export const MINIO_BUCKET = getEnv("MINIO_BUCKET");

// Session Configuration
export const SESSION_SECRET = getEnv("SESSION_SECRET");

// Application Configuration
export const NODE_ENV = process.env.NODE_ENV || "development";
