import { Router } from "express";
import { miscRouter } from "./misc";
import { statusRouter } from "./status";
import { modelsRouter } from "./models";
import { providersRouter } from "./providers";
import { chatRouter } from "./chat";

const apiRouter: Router = Router();

// 挂载所有 API 子路由
apiRouter.use("/", miscRouter);
apiRouter.use("/", statusRouter);
apiRouter.use("/", modelsRouter);
apiRouter.use("/", providersRouter);
apiRouter.use("/", chatRouter);

export { apiRouter };
