import express from "express";

import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { classRouter } from "./routes/class.routes.js";
import { studentRouter } from "./routes/student.routes.js";

import { errorHandler, notFound } from "./middleware/error-handler.js";

export const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/classes", classRouter);
app.use("/api/students", studentRouter);

app.use(notFound);
app.use(errorHandler);
