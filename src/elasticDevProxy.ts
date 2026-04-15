/** Must stay aligned with `vite-plugin-elastic-proxy.ts` mount path. */
export function resolveElasticProxyMountPath(viteBase: string): string {
  const b = (viteBase || "/").trim();
  if (b === "/" || b === "") return "/__elastic-proxy";
  const noTrail = b.endsWith("/") ? b.slice(0, -1) : b;
  const abs = noTrail.startsWith("/") ? noTrail : `/${noTrail}`;
  if (abs === "" || abs === ".") return "/__elastic-proxy";
  return `${abs}/__elastic-proxy`;
}

export function getElasticDevProxyUrl(): string {
  return resolveElasticProxyMountPath(import.meta.env.BASE_URL);
}
