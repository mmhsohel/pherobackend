import jwt from "jsonwebtoken";

export function verifyJWT(req, res, next) {
  const token = req.cookies?.ss_token;
  if (!token) return res.status(401).json({ message: "Unauthorized: no token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); 
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
}