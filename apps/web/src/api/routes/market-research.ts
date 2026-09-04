// Market Research Routes
import express, { Router, Request, Response } from "express";

import { authMiddleware } from "../middleware/auth";
import { asyncHandler, ValidationError } from "../middleware/error-handler";
import {
  createMarketResearch,
  listMarketResearch,
  getMarketResearch,
} from "../services/market-research-service";

const router: Router = express.Router();

// All market research routes require authentication
router.use(authMiddleware);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, industry, status } = req.query;
    const { user } = req as { user: { id: string } };

    const result = await listMarketResearch(user.id, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      industry: typeof industry === "string" ? industry : undefined,
      status: typeof status === "string" ? status : undefined,
    });

    res.json({ success: true, ...result });
  }),
);

router.post(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const { title, industry, targetMarket, methodology, budget } = _req.body as {
      title?: string;
      industry?: string;
      targetMarket?: string;
      methodology?: string;
      budget?: string;
    };
    const { user } = _req as unknown as { user: { id: string } };

    if (typeof title !== "string" || typeof industry !== "string") {
      throw new ValidationError("title and industry are required", {
        title: typeof title !== "string" ? "Title is required" : "",
        industry: typeof industry !== "string" ? "Industry is required" : "",
      });
    }

    const research = await createMarketResearch({
      title,
      industry,
      targetMarket,
      methodology,
      budget,
      ownerId: user.id,
    });

    res.status(201).json({ success: true, data: research as unknown });
  }),
);

router.get(
  "/:researchId",
  asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params["researchId"] as string;
    const { user } = req as unknown as { user: { id: string } };
    const research = await getMarketResearch(researchId, user.id);
    res.json({ success: true, data: research as unknown });
  }),
);

router.put(
  "/:researchId",
  asyncHandler(async (req: Request, res: Response) => {
    const { title, industry, targetMarket, methodology, budget, description } = req.body as {
      title?: string;
      industry?: string;
      targetMarket?: string;
      methodology?: string;
      budget?: string;
      description?: string;
    };
    const { user } = req as unknown as { user: { id: string } };

    const research = await createMarketResearch({
      title,
      industry,
      targetMarket,
      methodology,
      budget,
      ownerId: user.id,
      description,
    } as {
      title: string;
      ownerId: string;
      description?: string;
      industry?: string;
      targetMarket?: string;
      methodology?: string;
      budget?: string;
    });

    res.json({ success: true, data: research as unknown });
  }),
);

router.delete(
  "/:researchId",
  asyncHandler(async (req: Request, res: Response) => {
    // Note: deleteMarketResearch is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    res.json({ success: true, message: "Delete not implemented" });
  }),
);

router.post(
  "/:researchId/insights",
  asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params["researchId"] as string;
    const { title } = req.body as { title?: string };
    const { user } = req as unknown as { user: { id: string } };

    if (!title) {
      throw new ValidationError("Insight title is required", {
        title: "Insight title is required",
      });
    }

    // Note: addInsight is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    const research = await getMarketResearch(researchId, user.id);
    res.json({ success: true, data: research as unknown });
  }),
);

router.post(
  "/:researchId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params["researchId"] as string;
    const { status } = req.body as { status?: string };
    const { user } = req as unknown as { user: { id: string } };

    if (!status) {
      throw new ValidationError("status is required", {
        status: "Status is required",
      });
    }

    // Note: updateStatus is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    const research = await getMarketResearch(researchId, user.id);
    res.json({ success: true, data: research as unknown });
  }),
);

export default router;
