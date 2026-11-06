import { Router } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";

const r = Router();
const isProd = process.env.NODE_ENV === "production";
const cookieOpts = {
  httpOnly: true, secure: isProd, sameSite: isProd ? "none" : "lax",
  maxAge: 7 * 24 * 3600 * 1000,
};


r.post("/jwt", async (req, res) => {
  const raw = req.cookies?.["better-auth.session_token"] || req.cookies?.["__Secure-better-auth.session_token"];
  if (!raw) return res.status(401).json({ message: "No active session" });
  const token = decodeURIComponent(raw).split(".")[0];

  const session = await col("session").findOne({ token, expiresAt: { $gt: new Date() } });
  if (!session) return res.status(401).json({ message: "Session expired" });

  const uid = session.userId;
  const user = await col("user").findOne({
    _id: { $in: [uid, ...(ObjectId.isValid(uid) ? [new ObjectId(uid)] : [])] },
  });
  if (!user) return res.status(401).json({ message: "User not found" });

  const jwtToken = jwt.sign({ email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("ss_token", jwtToken, cookieOpts).json({ success: true });
});

r.post("/logout", (_req, res) => res.clearCookie("ss_token", cookieOpts).json({ success: true }));
export default r;