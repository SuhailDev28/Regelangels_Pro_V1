let ioInstance = null;

export function setNotificationIO(io) {
  ioInstance = io;
}

export function getNotificationIO() {
  return ioInstance;
}

export function emitNotificationToUser(userId, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${String(userId)}`).emit("notification:new", payload);
}

export function emitNotificationToAcademyRole(academyId, role, payload) {
  if (!ioInstance || !academyId || !role) return;
  ioInstance
    .to(`academy:${String(academyId)}:role:${String(role).toUpperCase()}`)
    .emit("notification:new", payload);
}
