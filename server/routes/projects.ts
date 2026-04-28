import { Router } from "express";
import { getProject, getProjectsByPhone } from "../lib/db.js";

const router = Router();

router.get("/", (req, res) => {
  const phone = req.user!.phone;
  const projects = getProjectsByPhone(phone);
  return res.json({ projects });
});

router.get("/:id", (req, res) => {
  const phone = req.user!.phone;
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (project.phone !== phone) return res.status(403).json({ error: "Forbidden" });
  return res.json({ project });
});

export default router;
