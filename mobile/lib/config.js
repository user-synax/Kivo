// Base URL for the Kivo backend (Express + Socket.IO).
// Web uses Next.js rewrites (/api/...) — native hits the backend directly.
// Android emulator: http://10.0.2.2:4000 | Physical device: http://<LAN-IP>:4000
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:4000";

export function apiUrl(path = "") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${p}`;
}
