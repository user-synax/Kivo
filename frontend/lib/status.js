import { apiGet, apiPost, apiDelete, apiPostForm } from "./api";

export function createStatus({ text, background, file }) {
  if (file) {
    const fd = new FormData();
    if (text) fd.set("text", text);
    if (background) fd.set("background", background);
    fd.set("media", file);
    return apiPostForm("/api/v1/status", fd);
  }
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
