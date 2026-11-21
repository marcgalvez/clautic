export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/·/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
export const RESERVED_SLUGS = new Set(["admin", "api", "panell", "login", "registre", "cita", "reserves", "www", "app"]);
