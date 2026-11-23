exports.sendSuccess = (res, data = null, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data });

exports.sendError = (res, message = "Server error", status = 500) =>
  res.status(status).json({ success: false, message });