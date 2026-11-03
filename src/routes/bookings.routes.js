import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const r = Router();

r.post("/", verifyJWT, async (req, res) => {
  const { studioId, date, startTime, endTime } = req.body; // date "2026-11-20", times "14:00"
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  if (!(start < end)) return res.status(400).json({ message: "End time must be after start time" });
  if (start < new Date()) return res.status(400).json({ message: "Cannot book a past slot" });

  const studio = await col("studios").findOne({ _id: new ObjectId(studioId) });
  if (!studio) return res.status(404).json({ message: "Studio not found" });
  if (studio.ownerEmail === req.user.email)
    return res.status(400).json({ message: "You cannot book your own studio" });

  // Overlap rule: existing.start < new.end AND existing.end > new.start
  const clash = await col("bookings").findOne({
    studioId, status: "Confirmed",
    startAt: { $lt: end }, endAt: { $gt: start },
  });
  if (clash) return res.status(409).json({
    message: `Slot unavailable: already booked ${clash.startTime}–${clash.endTime} on ${clash.date}`,
  });

  const hours = (end - start) / 36e5;
  const booking = {
    studioId, studioTitle: studio.title, studioImage: studio.image,
    hostEmail: studio.ownerEmail,
    userEmail: req.user.email, userName: req.user.name,
    date, startTime, endTime, startAt: start, endAt: end, hours,
    totalPrice: hours * studio.hourlyRate + studio.deposit,
    status: "Pending", createdAt: new Date(),
  };
  const result = await col("bookings").insertOne(booking);
  res.status(201).json({ insertedId: result.insertedId });
});

// Guest: my bookings
r.get("/mine", verifyJWT, async (req, res) =>
  res.json(await col("bookings").find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray()));

// Host: requests on my studios
r.get("/host", verifyJWT, async (req, res) =>
  res.json(await col("bookings").find({ hostEmail: req.user.email }).sort({ createdAt: -1 }).toArray()));

// Public: busy slots for a studio/day (shows availability)
r.get("/availability/:studioId", async (req, res) =>
  res.json(await col("bookings").find(
    { studioId: req.params.studioId, status: "Confirmed", date: req.query.date },
    { projection: { startTime: 1, endTime: 1 } }).toArray()));

// Guest cancels only Pending
r.patch("/:id/cancel", verifyJWT, async (req, res) => {
  const result = await col("bookings").updateOne(
    { _id: new ObjectId(req.params.id), userEmail: req.user.email, status: "Pending" },
    { $set: { status: "Cancelled" } });
  result.matchedCount ? res.json({ success: true })
    : res.status(400).json({ message: "Only pending bookings can be cancelled" });
});

// Host confirms (re-checks overlap)
r.patch("/:id/confirm", verifyJWT, async (req, res) => {
  const b = await col("bookings").findOne({ _id: new ObjectId(req.params.id), hostEmail: req.user.email, status: "Pending" });
  if (!b) return res.status(404).json({ message: "Pending booking not found" });
  const clash = await col("bookings").findOne({
    studioId: b.studioId, status: "Confirmed", startAt: { $lt: b.endAt }, endAt: { $gt: b.startAt },
  });
  if (clash) return res.status(409).json({ message: "Another confirmed booking overlaps this slot" });
  await col("bookings").updateOne({ _id: b._id }, { $set: { status: "Confirmed" } });
  res.json({ success: true });
});

export default r;