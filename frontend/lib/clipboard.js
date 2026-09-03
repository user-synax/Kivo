// Clipboard helper with a legacy fallback. Returns true when the text made it
// onto the clipboard (so callers can show "Copied" feedback) and never throws.
export async function copyText(text) {
  if (typeof window === "undefined" || text == null) return false;
  const value = String(text);
  if (!value) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// Best-effort text summary of a message for Copy / Share / selection exports.
export function messageText(message) {
  if (!message) return "";
  if (message.content) return message.content;
  const files = message.attachments || [];
  if (files.length === 1) {
    const f = files[0];
    if (f.kind === "image") return `📷 ${f.fileName || "Image"}`;
    if (f.kind === "audio") return "🎙️ Voice message";
    return `📎 ${f.fileName || "File"}`;
  }
  if (files.length > 1) return `📎 ${files.length} attachments`;
  return "";
}
