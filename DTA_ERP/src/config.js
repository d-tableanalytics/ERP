const envApiUrl =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const runtimeOrigin =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "";

const runtimeHostname =
  typeof window !== "undefined" && window.location?.hostname
    ? window.location.hostname
    : "";

function isLoopbackHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isLoopbackUrl(url) {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

const shouldIgnoreEnvApiUrl =
  envApiUrl &&
  runtimeHostname &&
  !isLoopbackHostname(runtimeHostname) &&
  isLoopbackUrl(envApiUrl);

export const API_BASE_URL = (
  shouldIgnoreEnvApiUrl ? runtimeOrigin : envApiUrl || runtimeOrigin || "http://localhost:5000"
).replace(/\/+$/, "");

