import { Router } from "express";
import { col } from "../config/db.js";
import { verifyJWT } from "../middleware/verifyJWT.js";
const r = Router();

r.get("/", verifyJWT, async (req, res) =>
  res.json(await col("wishlist").find({ userEmail: req.user.email }).toArray()));

r.post("/toggle", verifyJWT, async (req, res) => {
  const { studioId } = req.body;
  const filter = { userEmail: req.user.email, studioId };
  const existing = await col("wishlist").findOne(filter);
  if (existing) { await col("wishlist").deleteOne(filter); return res.json({ saved: false }); }
  await col("wishlist").insertOne({ ...filter, createdAt: new Date() });
  res.json({ saved: true });
});
export default r;