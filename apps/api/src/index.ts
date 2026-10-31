import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Class Management System API is running",
  });
});

app.listen(PORT, () => {
  console.log(`API server is running at http://localhost:${PORT}`);
});
