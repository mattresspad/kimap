import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { BASE_MAP_IMAGES, baseMapPreviewPath } from "../modules/viewport/base-map-resolution.js";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".tga", "image/x-tga"],
  [".webp", "image/webp"]
]);

function sendText(response, status, message) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(message);
}

function serveStatic(response, root, requestUrl, method) {
  let pathname;

  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendText(response, 400, "Invalid request path.");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = resolve(root, relativePath);
  const rootPrefix = `${resolve(root)}${sep}`;

  if (filePath !== resolve(root) && !filePath.startsWith(rootPrefix)) {
    sendText(response, 403, "Path access denied.");
    return;
  }

  try {
    if (statSync(filePath).isDirectory()) filePath = resolve(filePath, "index.html");
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": stat.size,
      "content-type":
        CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream"
    });

    if (method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "File not found.");
  }
}

export function createDevRequestHandler({ root }) {
  const resolvedRoot = resolve(root);

  return async function handleRequest(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:8000");
    const method = request.method ?? "GET";

    if (requestUrl.pathname.startsWith("/__dev/base-map/")) {
      if (method !== "GET" && method !== "HEAD") {
        sendText(response, 405, "Only GET and HEAD image preview requests are supported.");
        return;
      }
      const record = BASE_MAP_IMAGES.find(
        (entry) => baseMapPreviewPath(entry) === requestUrl.pathname
      );
      if (!record) {
        sendText(response, 404, "Unknown base-map preview image.");
        return;
      }
      serveStatic(response, resolvedRoot, new URL("/" + record.path, requestUrl), method);
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      sendText(response, 405, "Only GET and HEAD static requests are supported.");
      return;
    }

    serveStatic(response, resolvedRoot, requestUrl, method);
  };
}
