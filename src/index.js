import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import studioRoutes from "./routes/studios.routes.js";
import bookingRoutes from "./routes/bookings.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => res.send("StudioSpace API running"));
app.use("/api/auth", authRoutes);
app.use("/api/studios", studioRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

connectDB().then(() =>
  app.listen(process.env.PORT, () => console.log(`API on :${process.env.PORT}`)));