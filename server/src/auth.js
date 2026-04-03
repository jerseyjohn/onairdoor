import crypto from "crypto";
import db from "./db.js";

const ADMIN_HEADER = "x-admin-token";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokensMatch(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getAuthRow() {
  return db.prepare("SELECT * FROM admin_auth WHERE id = 1").get();
}

function getStoredTokenHash() {
  return getAuthRow()?.token_hash || "";
}

export function isAdminConfigured() {
  return Boolean(getStoredTokenHash());
}

export function initializeAdminToken(token) {
  const clean = token.trim();
  if (clean.length < 8) {
    throw new Error("Admin token must be at least 8 characters.");
  }

  if (isAdminConfigured()) {
    throw new Error("Admin token has already been configured.");
  }

  db.prepare(`
    UPDATE admin_auth
    SET
      token_hash = ?,
      configured_at = ?
    WHERE id = 1
  `).run(hashToken(clean), new Date().toISOString());
}

export function initializeAdminTokenFromEnvironment() {
  const bootstrapAdminToken = (process.env.ADMIN_TOKEN || "").trim();
  if (!bootstrapAdminToken || isAdminConfigured()) {
    return false;
  }

  initializeAdminToken(bootstrapAdminToken);
  return true;
}

export function verifyAdminToken(token) {
  const tokenHash = getStoredTokenHash();
  if (!tokenHash) {
    return false;
  }

  return tokensMatch(hashToken(token || ""), tokenHash);
}

export function requireSetupAvailable(_req, res, next) {
  if (isAdminConfigured()) {
    return res.status(409).json({
      error: "Already configured",
      message: "Admin setup is already complete."
    });
  }

  return next();
}

export function requireAdmin(req, res, next) {
  const suppliedToken = req.header(ADMIN_HEADER);

  if (!isAdminConfigured()) {
    return res.status(428).json({
      error: "Setup required",
      message: "Create the admin token before using the admin API."
    });
  }

  if (!suppliedToken || !verifyAdminToken(suppliedToken)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: `Provide ${ADMIN_HEADER} with the configured admin token.`
    });
  }

  return next();
}
