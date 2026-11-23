export const initials = (name) => (name || "Student").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "S";
export const formatDate = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
