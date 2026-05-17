const rateLimit = require('express-rate-limit');
const { verifyUserToken, isAdmin } = require('./firebase');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    const decoded = await verifyUserToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }
}

async function adminMiddleware(req, res, next) {
  try {
    const admin = await isAdmin(req.user.uid);

    if (!admin) {
      return res.status(403).json({
        error: 'Admin only'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Server error'
    });
  }
}

module.exports = {
  limiter,
  authMiddleware,
  adminMiddleware
};