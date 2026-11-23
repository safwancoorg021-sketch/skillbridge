const StudentNotification = require("../models/StudentNotification");
const User = require("../models/User");

function cleanNotification(notification = {}) {
  const linkPath = typeof notification.linkPath === "string" && notification.linkPath.startsWith("/")
    ? notification.linkPath.slice(0, 200)
    : "";
  return {
    type: ["offer", "enrollment", "progress", "system"].includes(notification.type) ? notification.type : "system",
    title: String(notification.title || "SkillBridge update").trim().slice(0, 100),
    message: String(notification.message || "There is a new update in your student portal.").trim().slice(0, 400),
    linkPath,
    ...(typeof notification.sourceKey === "string" && notification.sourceKey.trim() ? { sourceKey: notification.sourceKey.trim().slice(0, 200) } : {}),
  };
}

exports.notifyStudent = async (studentId, notification) => {
  try {
    if (!studentId) return;
    const fields = { student: studentId, ...cleanNotification(notification) };
    if (fields.sourceKey) {
      await StudentNotification.updateOne(
        { student: studentId, sourceKey: fields.sourceKey },
        { $setOnInsert: fields },
        { upsert: true }
      );
    } else {
      await StudentNotification.create(fields);
    }
  } catch (error) {
    console.error("Unable to create student notification:", error.message);
  }
};

exports.notifyAllStudents = async (notification) => {
  try {
    const students = await User.find({ role: "student", isBlocked: false }).select("_id").lean();
    if (!students.length) return;
    const fields = cleanNotification(notification);
    if (fields.sourceKey) {
      await StudentNotification.bulkWrite(students.map(({ _id }) => ({
        updateOne: {
          filter: { student: _id, sourceKey: fields.sourceKey },
          update: { $setOnInsert: { student: _id, ...fields } },
          upsert: true,
        },
      })));
    } else {
      await StudentNotification.insertMany(students.map(({ _id }) => ({ student: _id, ...fields })), { ordered: false });
    }
  } catch (error) {
    console.error("Unable to broadcast student notification:", error.message);
  }
};
