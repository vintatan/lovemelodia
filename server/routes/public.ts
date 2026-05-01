import { Router } from "express";
import { getShowcaseItems, getSocialProof } from "../lib/db.js";

const router = Router();

router.get("/showcase", (_req, res) => {
  const items = getShowcaseItems();
  res.json({ items });
});

router.get("/stats", (_req, res) => {
  const data = getSocialProof();
  res.json(data);
});

export default router;
