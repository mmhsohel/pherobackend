import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const r = Router();
const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);


r.get("/", async (req, res) => {
  const { search, category, sort, limit, minPrice, maxPrice } = req.query;
  const q = {};
  if (search) q.$or = [
    { title: { $regex: search, $options: "i" } },
    { location: { $regex: search, $options: "i" } },
  ];
  if (category && category !== "All") q.category = category;
  if (minPrice || maxPrice) q.hourlyRate = {
    ...(minPrice && { $gte: +minPrice }), ...(maxPrice && { $lte: +maxPrice }),
  };
  const sorts = {
    rating: { rating: -1 }, newest: { createdAt: -1 },
    priceAsc: { hourlyRate: 1 }, priceDesc: { hourlyRate: -1 },
  };
  let cursor = col("studios").find(q).sort(sorts[sort] || { createdAt: -1 });
  if (limit) cursor = cursor.limit(+limit);      
  res.json(await cursor.toArray());
});

r.get("/mine/list", verifyJWT, async (req, res) =>
  res.json(await col("studios").find({ ownerEmail: req.user.email }).toArray()));

r.get("/:id", async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ message: "Invalid ID" });
  const studio = await col("studios").findOne({ _id });
  studio ? res.json(studio) : res.status(404).json({ message: "Studio not found" });
});

r.post("/", verifyJWT, async (req, res) => {
  const doc = {
    ...req.body,
    hourlyRate: +req.body.hourlyRate, deposit: +req.body.deposit, capacity: +req.body.capacity,
    ownerEmail: req.user.email, ownerName: req.user.name,   // never trust client for owner
    rating: 0, reviews: [], createdAt: new Date(),
  };
  const result = await col("studios").insertOne(doc);
  res.status(201).json({ insertedId: result.insertedId });
});

r.put("/:id", verifyJWT, async (req, res) => {
  const { _id, ownerEmail, ownerName, createdAt, ...updates } = req.body;
  const result = await col("studios").updateOne(
    { _id: oid(req.params.id), ownerEmail: req.user.email },
    { $set: { ...updates, updatedAt: new Date() } }
  );
  result.matchedCount ? res.json({ success: true })
    : res.status(403).json({ message: "Not found or not your listing" });
});

r.delete("/:id", verifyJWT, async (req, res) => {
  const result = await col("studios").deleteOne({ _id: oid(req.params.id), ownerEmail: req.user.email });
  result.deletedCount ? res.json({ success: true })
    : res.status(403).json({ message: "Not found or not your listing" });
});

export default r;