/**
 * Analytics Routes — Agency performance metrics
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { analyticsService } from "../services/analytics.js";
import { assertCompanyAccess } from "./authz.js";

export function analyticsRoutes(db: Db) {
  const router = Router();
  const analytics = analyticsService(db);

  router.get("/companies/:companyId/analytics", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { start, end } = req.query;
    const range =
      typeof start === "string" && typeof end === "string"
        ? { start: new Date(start), end: new Date(end) }
        : undefined;

    const data = await analytics.summary(companyId, range);
    res.json(data);
  });

  return router;
}
