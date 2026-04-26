import { Router } from "express";
import { runAgentController } from "../controller/agent.controller";

const router = Router();

/**
 * POST /api/agent/run
 * Body: { url: string, platforms?: Platform[] }
 */
router.post("/run", runAgentController);

export default router;