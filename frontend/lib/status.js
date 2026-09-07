import { apiGet, apiPost, apiDelete } from "./api";

export function createStatus({ text, background }) {
  return apiPost("/api/v1/status", { text, background });
}
export function fetchStatusFeed() {
  return apiGet("/api/v1/status/feed");
}
export function fetchMyStatuses() {
  return apiGet("/api/v1/status/me");
}
export function viewStatus(id) {
  return apiPost(`/api/v1/status/${id}/view`, {});
}
export function deleteStatus(id) {
  return apiDelete(`/api/v1/status/${id}`);
}
