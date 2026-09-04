// Sales Opportunities Routes
import express, { Router, Request, Response } from "express";

import { authMiddleware } from "../middleware/auth";
import { asyncHandler, ValidationError } from "../middleware/error-handler";

interface SalesOpportunityBody {
  title?: string;
  amount?: number;
  stage?: string;
  description?: string;
  accountName?: string;
  probability?: number;
  closeDate?: string;
  contacts?: unknown[];
  status?: string;
}

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface ActivityBody {
  type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
import {
  listSalesOpportunities,
  createSalesOpportunity,
  getSalesOpportunity,
  updateSalesOpportunity,
  deleteSalesOpportunity,
  updateStage,
  addContact,
  addActivity,
} from "../services/sales-service";

const router: Router = express.Router();

// All sales opportunity routes require authentication
router.use(authMiddleware);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const pageParam = req.query["page"];
    const limitParam = req.query["limit"];
    const stageParam = req.query["stage"];
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const result = await listSalesOpportunities(userId, {
      page: typeof pageParam === "string" ? parseInt(pageParam) : 1,
      limit: typeof limitParam === "string" ? parseInt(limitParam) : 50,
      stage: typeof stageParam === "string" ? stageParam : undefined,
    });

    res.json({ success: true, ...result });
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as SalesOpportunityBody;
    const { title, amount, stage, description } = body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!title || !amount || !stage) {
      throw new ValidationError("title, amount, and stage are required", {
        title: !title ? "Title is required" : "",
        amount: !amount ? "Amount is required" : "",
        stage: !stage ? "Stage is required" : "",
      });
    }

    const opportunity = await createSalesOpportunity({
      title,
      description,
      ownerId: userId,
      accountName: body.accountName,
      amount,
      probability: body.probability,
      stage,
      closeDate: body.closeDate ? new Date(body.closeDate) : undefined,
    });

    res.status(201).json({ success: true, data: opportunity });
  }),
);

router.get(
  "/:opportunityId",
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params["opportunityId"] ?? "");
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const opportunity = await getSalesOpportunity(opportunityId, userId);

    res.json({ success: true, data: opportunity });
  }),
);

router.put(
  "/:opportunityId",
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params["opportunityId"] ?? "");
    const body = req.body as SalesOpportunityBody;
    const { title, amount, stage } = body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const opportunity = await updateSalesOpportunity(opportunityId, userId, {
      title,
      value: amount,
      stage,
      contacts: body.contacts as Record<string, unknown>[] | undefined,
      expectedCloseDate: body.closeDate ? new Date(body.closeDate) : undefined,
      probability: body.probability,
      status: body.status,
    });

    res.json({ success: true, data: opportunity });
  }),
);

router.delete(
  "/:opportunityId",
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params["opportunityId"] ?? "");
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    await deleteSalesOpportunity(opportunityId, userId);

    res.json({ success: true, message: "Opportunity deleted" });
  }),
);

router.put(
  "/:opportunityId/stage",
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params["opportunityId"] ?? "");
    const body = req.body as SalesOpportunityBody;
    const { stage } = body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!stage) {
      throw new ValidationError("stage is required", {
        stage: "Stage is required",
      });
    }

    const opportunity = await updateStage(opportunityId, userId, stage);

    res.json({ success: true, data: opportunity });
  }),
);

router.post(
  "/:opportunityId/contacts",
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params["opportunityId"] ?? "");
    const body = req.body as ContactBody;
    const { name, email, phone, role } = body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!name) {
      throw new ValidationError("contact name is required", {
        name: "Contact name is required",
      });
    }

    const opportunity = await addContact(opportunityId, userId, {
      name,
      email,
      phone,
      role,
    });

    res.json({ success: true, data: opportunity });
  }),
);

router.post(
  "/:opportunityId/activities",
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params["opportunityId"] ?? "");
    const body = req.body as ActivityBody;
    const { type, description, metadata } = body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!type || !description) {
      throw new ValidationError("type and description are required", {
        type: !type ? "Type is required" : "",
        description: !description ? "Description is required" : "",
      });
    }

    const opportunity = await addActivity(opportunityId, userId, {
      type: type as Parameters<typeof addActivity>[2]["type"],
      description,
      metadata,
    });

    res.json({ success: true, data: opportunity });
  }),
);

export default router;
