// Ensure tsx does not define globalThis.__dirname as '.' which breaks ESM libraries expecting standard Node ESM
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

  // Robust port resolution: respect process.env.PORT if set, otherwise 8080 on Cloud Run (K_SERVICE), else 3000 for AI Studio Preview & local dev.
  const isCloudRun = Boolean(process.env.K_SERVICE);
  const PORT = Number(process.env.PORT) || (isCloudRun ? 8080 : 3000);

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
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("[Server] Vite dev middleware failed to load, falling back to static/API mode:", e);
    }
  } else {
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      const buildPath = path.join(process.cwd(), "build");
      if (fs.existsSync(path.join(buildPath, "index.html"))) {
        distPath = buildPath;
      } else {
        distPath = process.cwd();
      }
    }
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.sendFile(path.join(process.cwd(), "index.html"));
      }
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[CallBreak Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[CallBreak Server] Health check ready at http://0.0.0.0:${PORT}/health`);
  });
}

startServer();
