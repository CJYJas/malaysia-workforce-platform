import { Router, type IRouter } from "express";
import {
  MatchJourneyBody, MatchJourneyResponse, CreateJourneyPathwayBody,
  CreateJourneyPathwayResponse, GetJourneyCatalogResponse, GetJourneySignalsResponse,
} from "@workspace/api-zod";
import { journeyCatalog, matchProfile, learningPathway, validInterests, hasRole } from "../lib/journey";
import { getSignalReport } from "../lib/outlook";

const router: IRouter = Router();
router.get("/journey/catalog", (_req, res) => {
  res.json(GetJourneyCatalogResponse.parse(journeyCatalog()));
});
router.get("/journey/signals", async (req, res) => {
  if (req.query.refresh !== undefined && req.query.refresh !== "true" && req.query.refresh !== "false") {
    res.status(400).json({ error: "refresh must be true or false" });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json(GetJourneySignalsResponse.parse(await getSignalReport(req.query.refresh === "true")));
});
router.post("/journey/matches", (req, res) => {
  res.set("Cache-Control", "no-store");
  const input = MatchJourneyBody.safeParse(req.body);
  if (!input.success || !validInterests(input.data.profile) || input.data.profile.skills.some(s => !s.name.trim())) {
    res.status(400).json({ error: "Provide a valid profile, at least one listed interest, and a supported scenario." });
    return;
  }
  res.json(MatchJourneyResponse.parse(matchProfile(input.data.profile, input.data.scenario)));
});
router.post("/journey/pathway", (req, res) => {
  res.set("Cache-Control", "no-store");
  const input = CreateJourneyPathwayBody.safeParse(req.body);
  if (!input.success || !validInterests(input.data.profile) || !hasRole(input.data.role_id) || input.data.profile.skills.some(s => !s.name.trim())) {
    res.status(400).json({ error: "Provide a valid profile, supported scenario and role." });
    return;
  }
  res.json(CreateJourneyPathwayResponse.parse(learningPathway(input.data.profile, input.data.scenario, input.data.role_id)));
});
export default router;
