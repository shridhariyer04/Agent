import express from "express";
// import marketingRoutes from "./routes/marketing.routes";

const app = express();

app.use(express.json());

// app.use("/api/marketing", marketingRoutes);

export default app;