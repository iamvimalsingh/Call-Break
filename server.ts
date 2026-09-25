// Ensure tsx does not define globalThis.__dirname as '.' which causes ESM plugins to resolve paths incorrectly
if (typeof (globalThis as any).__dirname === 'string' && (globalThis as any).__dirname === '.') {
  delete (globalThis as any).__dirname;
}

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { setupWebSocketServer } from "./server/src/index";
import { createAdminRouter } from "./server/src/adminRouter";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  // In development, dev server MUST run on 3000 (reverse-proxied by nginx).
  // In production (e.g. Cloud Run), listen on process.env.PORT (typically 8080) as provided by Cloud Run container runtime.
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
  const PORT = isProduction ? (Number(process.env.PORT) || 8080) : 3000;

  app.use(express.json());

  // Health check routes for Render.com & control plane
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server" });
  });

  // API health and info
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server", timestamp: new Date().toISOString() });
  });

  // Attach WebSocket server on /ws
  const wss = setupWebSocketServer(server);

  // Authenticated Admin REST inspection endpoints
  app.use("/api/admin", createAdminRouter({ getActiveConnectionsCount: () => wss.clients.size }));

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      const buildPath = path.join(process.cwd(), "build");
      if (fs.existsSync(path.join(buildPath, "index.html"))) {
        distPath = buildPath;
      } else if (fs.existsSync(path.join(process.cwd(), "index.html"))) {
        distPath = process.cwd();
      }
    }
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server running on port ${PORT}`);
    console.log(`CallBreak full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
