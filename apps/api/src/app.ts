import express from "express";
import { healthRouter } from "./routes/health.routes.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
// Data endpoints will be registered here after authentication/authorization.
app.use(notFound);
app.use(errorHandler);
