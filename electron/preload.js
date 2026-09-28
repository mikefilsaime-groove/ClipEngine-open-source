// ClipEngine runs entirely in the Next.js renderer — no IPC surface is
// exposed to the page. This preload intentionally exposes nothing.
// Keeping the file around means contextIsolation + sandbox stay on and
// we have a spot to hang future APIs if needed.
