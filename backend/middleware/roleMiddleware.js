const requireRole = (...allowedRoles) => {
  if (allowedRoles.length === 0) {
    throw new Error("At least one allowed role must be provided.");
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    return next();
  };
};

module.exports = requireRole;
