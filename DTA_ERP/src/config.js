const envApiUrl =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const runtimeOrigin =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "";

export const API_BASE_URL = (envApiUrl || runtimeOrigin || "http://localhost:5000").replace(/\/+$/, "");

