import Log from "../models/log.js";

export const logEvent = async ({
  type,
  action,
  user = null,
  email = null,
  query = null,
  intent = [],
  response = "",
  success = true,
  req,
  responseTime = 0
}) => {
  try {
    await Log.create({
      type,
      action,
      user,
      email,
      query,
      intent,
      response,
      success,
      responseTime,
      ip: req?.ip,
      userAgent: req?.headers["user-agent"]
    });
  } catch (err) {
    console.log("Log error:", err.message);
  }
};