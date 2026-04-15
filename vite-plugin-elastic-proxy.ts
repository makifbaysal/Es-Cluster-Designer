import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { resolveElasticProxyMountPath } from "./src/elasticDevProxy";

function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error("Body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

type ProxyPayload = {
  baseUrl?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
};

function mountElasticProxy(
  middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void },
  mountPath: string
): void {
  middlewares.use(mountPath, async (req, res, next) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    let body: string;
    try {
      body = await readRequestBody(req, 64 * 1024);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { reason: "Invalid request body" } }));
      return;
    }

    let parsed: ProxyPayload;
    try {
      parsed = JSON.parse(body) as ProxyPayload;
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { reason: "Invalid JSON body" } }));
      return;
    }

    const baseUrl = (parsed.baseUrl ?? "").trim();
    const relPath = parsed.path?.startsWith("/") ? parsed.path : `/${parsed.path ?? ""}`;
    const method = (parsed.method ?? "GET").toUpperCase();
    if (method !== "GET") {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { reason: "Only GET is supported" } }));
      return;
    }

    let target: URL;
    try {
      target = new URL(relPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { reason: "Invalid cluster URL or path" } }));
      return;
    }

    const forward = new Headers();
    if (parsed.headers) {
      for (const [k, v] of Object.entries(parsed.headers)) {
        if (v === undefined || v === "") continue;
        const lk = k.toLowerCase();
        if (lk === "accept" || lk === "authorization") {
          forward.set(k, v);
        }
      }
    }

    try {
      const upstream = await fetch(target, { method: "GET", headers: forward });
      const text = await upstream.text();
      res.statusCode = upstream.status;
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.end(text);
    } catch (e) {
      const reason =
        e instanceof Error ? e.message : "Unknown error reaching Elasticsearch";
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            reason: `Dev proxy could not reach Elasticsearch (${reason}). Check URL, VPN/firewall, and that the node accepts connections from your machine.`,
          },
        })
      );
    }
  });
}

export function elasticDevProxyPlugin(): Plugin {
  return {
    name: "elastic-dev-proxy",
    configureServer(server) {
      const mountPath = resolveElasticProxyMountPath(server.config.base);
      mountElasticProxy(server.middlewares, mountPath);
    },
    configurePreviewServer(server) {
      const mountPath = resolveElasticProxyMountPath(server.config.base);
      mountElasticProxy(server.middlewares, mountPath);
    },
  };
}
