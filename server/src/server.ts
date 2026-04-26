import "dotenv/config";
import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  🚀  Server running on http://localhost:${PORT}`);
  console.log(`  📋  Health  →  GET  /health`);
  console.log(`  🤖  Agent   →  POST /api/agent/run`);
  console.log(`${"═".repeat(50)}\n`);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received — shutting down gracefully");
  server.close(() => {
    console.log("[server] Closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[server] SIGINT received — shutting down gracefully");
  server.close(() => {
    console.log("[server] Closed");
    process.exit(0);
  });
});