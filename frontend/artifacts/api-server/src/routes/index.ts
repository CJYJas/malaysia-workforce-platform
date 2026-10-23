import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workforceRouter from "./workforce";
import journeyRouter from "./journey";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workforceRouter);
router.use(journeyRouter);

export default router;
