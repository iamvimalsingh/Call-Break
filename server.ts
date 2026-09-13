import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { setupWebSocketServer } from "./server/src/index";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check routes for Render.com
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server" });
  });

  // API health and info
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server", timestamp: new Date().toISOString() });
  });

  // Attach WebSocket server on /ws
  setupWebSocketServer(server);

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`CallBreak full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
