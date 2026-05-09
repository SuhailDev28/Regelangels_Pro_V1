import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "../../../lib/api.js";
import { getSocket } from "../../../lib/socket.js";
import { getUser } from "../../../lib/auth.js";

const NotificationsContext = createContext(null);

function normalizeId(v) {
  return String(v || "").trim();
}

function normalizeUpper(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function getUserId(user) {
  return normalizeId(user?._id || user?.id || user?.userId || "");
}

function getAcademyId(user) {
  return normalizeId(
    user?.academyId?._id ||
      user?.academyId?.id ||
      user?.academy?._id ||
      user?.academy?.id ||
      user?.academyId ||
      user?.academy ||
      "",
  );
}

function getRole(user) {
  return normalizeUpper(user?.role || "");
}

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function isItemRead(item) {
  return item?.isRead === true || item?.read === true || Boolean(item?.readAt);
}

function sameId(a, b) {
  return normalizeId(a) === normalizeId(b);
}

function mapNotificationItem(item) {
  if (!item || typeof item !== "object") return null;

  const id = normalizeId(item?._id || item?.id || item?.notificationId);

  const rawAcademyId =
    item?.academyId?._id ||
    item?.academyId?.id ||
    item?.academyId ||
    item?.academy ||
    "";

  const rawRecipientUserId =
    item?.recipientUserId?._id ||
    item?.recipientUserId?.id ||
    item?.recipientUserId ||
    item?.userId?._id ||
    item?.userId?.id ||
    item?.userId ||
    "";

  const read = isItemRead(item);

  return {
    ...item,

    _id: id || null,
    id: id || null,

    academyId: normalizeId(rawAcademyId),

    recipientUserId: normalizeId(rawRecipientUserId),
    userId: normalizeId(rawRecipientUserId),

    role: normalizeUpper(item?.role || item?.recipientRole || ""),
    recipientRole: normalizeUpper(item?.recipientRole || item?.role || ""),

    type: normalizeUpper(item?.type || item?.category || "SYSTEM"),
    category: normalizeUpper(item?.category || item?.type || "SYSTEM"),
    priority: normalizeUpper(item?.priority || "NORMAL"),

    title: String(item?.title || "").trim(),
    message: String(item?.message || item?.body || "").trim(),

    isRead: read,
    read,
    readAt: item?.readAt || null,

    actionUrl: String(item?.actionUrl || item?.link || "").trim(),

    entityType: String(item?.entityType || "").trim(),
    entityId: item?.entityId ? String(item.entityId) : null,

    meta:
      item?.meta && typeof item.meta === "object" && !Array.isArray(item.meta)
        ? item.meta
        : {},

    metadata:
      item?.metadata &&
      typeof item.metadata === "object" &&
      !Array.isArray(item.metadata)
        ? item.metadata
        : item?.meta &&
            typeof item.meta === "object" &&
            !Array.isArray(item.meta)
          ? item.meta
          : {},

    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
}

function extractItems(data) {
  return toArray(
    data?.items || data?.notifications || data?.rows || data?.data || [],
  )
    .map(mapNotificationItem)
    .filter(Boolean)
    .filter((item) => item._id);
}

function extractUnread(data, fallback = 0) {
  const n = Number(
    data?.unreadCount ??
      data?.unread ??
      data?.count ??
      data?.totalUnread ??
      fallback,
  );

  return Number.isFinite(n) ? n : fallback;
}

function extractTotal(data, fallbackItems = []) {
  const n = Number(data?.total ?? fallbackItems.length ?? 0);
  return Number.isFinite(n) ? n : fallbackItems.length;
}

function extractPage(data, fallback = 1) {
  const n = Number(data?.page ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function extractPages(data, fallback = 1) {
  const n = Number(data?.pages ?? data?.totalPages ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* ---------------------------------------
 * COMMON API HELPERS
 * Backend route: /api/notifications
 * ------------------------------------- */

async function apiNotifications(params = {}) {
  if (typeof api?.notifications === "function") {
    return api.notifications(params);
  }

  if (typeof api?.get === "function") {
    return api.get("/notifications", { params });
  }

  throw new Error("Notifications API not available");
}

async function apiUnreadCount() {
  if (typeof api?.notificationUnreadCount === "function") {
    return api.notificationUnreadCount();
  }

  if (typeof api?.get === "function") {
    return api.get("/notifications/unread-count");
  }

  throw new Error("Notification unread count API not available");
}

async function apiMarkRead(id) {
  if (typeof api?.markNotificationRead === "function") {
    return api.markNotificationRead(id);
  }

  if (typeof api?.notificationMarkRead === "function") {
    return api.notificationMarkRead(id);
  }

  if (typeof api?.patch === "function") {
    return api.patch(`/notifications/${id}/read`, {});
  }

  throw new Error("Notification mark read API not available");
}

async function apiMarkUnread(id) {
  if (typeof api?.markNotificationUnread === "function") {
    return api.markNotificationUnread(id);
  }

  if (typeof api?.notificationMarkUnread === "function") {
    return api.notificationMarkUnread(id);
  }

  if (typeof api?.patch === "function") {
    return api.patch(`/notifications/${id}/unread`, {});
  }

  throw new Error("Notification mark unread API not available");
}

async function apiMarkAllRead() {
  if (typeof api?.markAllNotificationsRead === "function") {
    return api.markAllNotificationsRead();
  }

  if (typeof api?.notificationMarkAllRead === "function") {
    return api.notificationMarkAllRead();
  }

  if (typeof api?.patch === "function") {
    return api.patch("/notifications/read-all", {});
  }

  throw new Error("Notification mark all read API not available");
}

async function apiBulkRead(ids = []) {
  const cleanIds = [...new Set(ids.map((x) => normalizeId(x)).filter(Boolean))];

  if (!cleanIds.length) return { ok: true };

  if (typeof api?.bulkReadNotifications === "function") {
    return api.bulkReadNotifications(cleanIds);
  }

  if (typeof api?.notificationBulkRead === "function") {
    return api.notificationBulkRead(cleanIds);
  }

  if (typeof api?.patch === "function") {
    return api.patch("/notifications/bulk-read", { ids: cleanIds });
  }

  throw new Error("Notification bulk read API not available");
}

async function apiDeleteNotification(id) {
  if (typeof api?.deleteNotification === "function") {
    return api.deleteNotification(id);
  }

  if (typeof api?.notificationDelete === "function") {
    return api.notificationDelete(id);
  }

  if (typeof api?.delete === "function") {
    return api.delete(`/notifications/${id}`);
  }

  throw new Error("Notification delete API not available");
}

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingUnread, setLoadingUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);

  const currentIdentityRef = useRef({
    userId: "",
    academyId: "",
    role: "",
  });

  const lastQueryRef = useRef({
    page: 1,
    limit: 20,
  });

  const requestSeqRef = useRef(0);

  const user = getUser();
  const userId = getUserId(user);
  const academyId = getAcademyId(user);
  const role = getRole(user);

  const loadUnread = useCallback(async () => {
    if (!userId || !role) return 0;

    try {
      setLoadingUnread(true);

      const data = await apiUnreadCount();
      const next = extractUnread(data, 0);

      setUnread(next);
      return next;
    } catch (err) {
      console.error("notification unread count failed", err);
      return 0;
    } finally {
      setLoadingUnread(false);
    }
  }, [userId, role]);

  const loadNotifications = useCallback(
    async (opts = {}) => {
      if (!userId || !role) return null;

      const nextPage = Math.max(1, Number(opts.page || 1));
      const limit = Math.max(1, Number(opts.limit || 20));

      const requestParams = {
        page: nextPage,
        limit,
        category: opts.category,
        type: opts.type,
        q: opts.q || opts.search,
      };

      if (opts.isRead !== undefined) {
        requestParams.isRead = opts.isRead;
      }

      if (opts.unreadOnly === true) {
        requestParams.isRead = false;
        requestParams.unreadOnly = true;
      }

      lastQueryRef.current = { ...requestParams };

      const seq = ++requestSeqRef.current;

      try {
        setLoading(true);
        setError("");

        const data = await apiNotifications(requestParams);

        if (seq !== requestSeqRef.current) return data;

        const nextItems = extractItems(data);

        setItems(nextItems);
        setUnread((prev) => extractUnread(data, prev));
        setPage(extractPage(data, nextPage));
        setPages(extractPages(data, 1));
        setTotal(extractTotal(data, nextItems));

        return data;
      } catch (err) {
        if (seq === requestSeqRef.current) {
          console.error("notifications fetch failed", err);
          setError(err?.message || "Failed to load notifications");
        }

        throw err;
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [userId, role],
  );

  const reloadCurrent = useCallback(async () => {
    const current = lastQueryRef.current || { page: 1, limit: 20 };
    return loadNotifications(current);
  }, [loadNotifications]);

  const prependNotification = useCallback(
    (item) => {
      const mapped = mapNotificationItem(item);
      const id = normalizeId(mapped?._id || mapped?.id);

      if (!id) return;

      if (
        mapped?.recipientUserId &&
        userId &&
        !sameId(mapped.recipientUserId, userId)
      ) {
        return;
      }

      setItems((prev) => {
        const existingIndex = prev.findIndex(
          (x) => normalizeId(x?._id || x?.id) === id,
        );

        if (existingIndex >= 0) {
          const copy = [...prev];
          const oldItem = copy[existingIndex];

          const oldUnread = !isItemRead(oldItem);
          const newUnread = !isItemRead(mapped);

          copy[existingIndex] = { ...oldItem, ...mapped };

          if (oldUnread !== newUnread) {
            setUnread((count) =>
              oldUnread && !newUnread
                ? Math.max(0, Number(count || 0) - 1)
                : !oldUnread && newUnread
                  ? Number(count || 0) + 1
                  : Number(count || 0),
            );
          }

          return copy;
        }

        if (!isItemRead(mapped)) {
          setUnread((count) => Number(count || 0) + 1);
        }

        setTotal((count) => Number(count || 0) + 1);

        return [mapped, ...prev];
      });
    },
    [userId],
  );

  const replaceNotification = useCallback(
    (item) => {
      const mapped = mapNotificationItem(item);
      const id = normalizeId(mapped?._id || mapped?.id);

      if (!id) return;

      if (
        mapped?.recipientUserId &&
        userId &&
        !sameId(mapped.recipientUserId, userId)
      ) {
        return;
      }

      setItems((prev) => {
        const oldItem = prev.find((x) => normalizeId(x?._id || x?.id) === id);

        if (!oldItem) return prev;

        const oldUnread = !isItemRead(oldItem);
        const newUnread = !isItemRead(mapped);

        if (oldUnread !== newUnread) {
          setUnread((count) =>
            oldUnread && !newUnread
              ? Math.max(0, Number(count || 0) - 1)
              : !oldUnread && newUnread
                ? Number(count || 0) + 1
                : Number(count || 0),
          );
        }

        return prev.map((x) =>
          normalizeId(x?._id || x?.id) === id ? { ...x, ...mapped } : x,
        );
      });
    },
    [userId],
  );

  const markRead = useCallback(
    async (id) => {
      const normalizedId = normalizeId(id);
      if (!normalizedId) return null;

      try {
        setBusy(true);
        setError("");

        const target = items.find(
          (x) => normalizeId(x?._id || x?.id) === normalizedId,
        );

        const wasUnread = target ? !isItemRead(target) : false;

        const data = await apiMarkRead(normalizedId);

        const updated = mapNotificationItem(
          data?.item || data?.notification || data || null,
        );

        setItems((prev) =>
          prev.map((item) =>
            normalizeId(item?._id || item?.id) === normalizedId
              ? {
                  ...item,
                  ...(updated || {}),
                  isRead: true,
                  read: true,
                  readAt:
                    updated?.readAt || item?.readAt || new Date().toISOString(),
                }
              : item,
          ),
        );

        if (wasUnread) {
          setUnread((prev) => Math.max(0, Number(prev || 0) - 1));
        }

        return updated;
      } catch (err) {
        console.error("notification mark read failed", err);
        setError(err?.message || "Failed to mark notification as read");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [items],
  );

  const markUnread = useCallback(
    async (id) => {
      const normalizedId = normalizeId(id);
      if (!normalizedId) return null;

      try {
        setBusy(true);
        setError("");

        const target = items.find(
          (x) => normalizeId(x?._id || x?.id) === normalizedId,
        );

        const wasUnread = target ? !isItemRead(target) : false;

        const data = await apiMarkUnread(normalizedId);

        const updated = mapNotificationItem(
          data?.item || data?.notification || data || null,
        );

        setItems((prev) =>
          prev.map((item) =>
            normalizeId(item?._id || item?.id) === normalizedId
              ? {
                  ...item,
                  ...(updated || {}),
                  isRead: false,
                  read: false,
                  readAt: null,
                }
              : item,
          ),
        );

        if (!wasUnread) {
          setUnread((prev) => Number(prev || 0) + 1);
        }

        return updated;
      } catch (err) {
        console.error("notification mark unread failed", err);
        setError(err?.message || "Failed to mark notification as unread");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [items],
  );

  const markAllRead = useCallback(async () => {
    try {
      setBusy(true);
      setError("");

      await apiMarkAllRead();

      const now = new Date().toISOString();

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
          read: true,
          readAt: item?.readAt || now,
        })),
      );

      setUnread(0);
      return true;
    } catch (err) {
      console.error("notification mark all read failed", err);
      setError(err?.message || "Failed to mark all notifications as read");
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const bulkRead = useCallback(async (ids = []) => {
    const cleanIds = [...new Set(ids.map(normalizeId).filter(Boolean))];

    if (!cleanIds.length) return null;

    try {
      setBusy(true);
      setError("");

      await apiBulkRead(cleanIds);

      let unreadReduced = 0;
      const now = new Date().toISOString();

      setItems((prev) =>
        prev.map((item) => {
          const itemId = normalizeId(item?._id || item?.id);

          if (cleanIds.includes(itemId) && !isItemRead(item)) {
            unreadReduced += 1;

            return {
              ...item,
              isRead: true,
              read: true,
              readAt: item?.readAt || now,
            };
          }

          return item;
        }),
      );

      if (unreadReduced > 0) {
        setUnread((prev) => Math.max(0, Number(prev || 0) - unreadReduced));
      }

      return true;
    } catch (err) {
      console.error("notification bulk read failed", err);
      setError(err?.message || "Failed to update notifications");
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteNotification = useCallback(
    async (id) => {
      const normalizedId = normalizeId(id);
      if (!normalizedId) return null;

      try {
        setBusy(true);
        setError("");

        const target = items.find(
          (x) => normalizeId(x?._id || x?.id) === normalizedId,
        );

        await apiDeleteNotification(normalizedId);

        setItems((prev) =>
          prev.filter((x) => normalizeId(x?._id || x?.id) !== normalizedId),
        );

        setTotal((prev) => Math.max(0, Number(prev || 0) - 1));

        if (target && !isItemRead(target)) {
          setUnread((prev) => Math.max(0, Number(prev || 0) - 1));
        }

        return true;
      } catch (err) {
        console.error("notification delete failed", err);
        setError(err?.message || "Failed to delete notification");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [items],
  );

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!userId || !role) {
      if (joinedRef.current) {
        try {
          const prev = currentIdentityRef.current || {};

          socket.emit("user:leave", {
            userId: prev.userId,
            academyId: prev.academyId,
            role: prev.role,
          });

          socket.emit("notification:leave", {
            userId: prev.userId,
            academyId: prev.academyId,
            role: prev.role,
          });
        } catch {
          // ignore
        }
      }

      joinedRef.current = false;

      currentIdentityRef.current = {
        userId: "",
        academyId: "",
        role: "",
      };

      setItems([]);
      setUnread(0);
      setPage(1);
      setPages(1);
      setTotal(0);
      setError("");

      return undefined;
    }

    currentIdentityRef.current = { userId, academyId, role };

    if (!joinedRef.current) {
      try {
        socket.emit("user:join", {
          userId,
          academyId,
          role,
        });

        socket.emit("notification:join", {
          userId,
          academyId,
          role,
        });

        joinedRef.current = true;
      } catch (err) {
        console.error("socket join failed", err);
      }
    }

    const onNewNotification = (item) => {
      prependNotification(item);
    };

    const onNotificationCreated = (item) => {
      prependNotification(item);
    };

    const onNotificationUpdated = (item) => {
      replaceNotification(item);
    };

    const onNotificationRead = (item) => {
      replaceNotification({
        ...(item || {}),
        isRead: true,
        read: true,
      });
    };

    const onNotificationDeleted = (payload) => {
      const deletedId = normalizeId(
        payload?.id || payload?.notificationId || payload?._id,
      );

      if (!deletedId) return;

      let removedAny = false;
      let removedUnread = false;

      setItems((prev) => {
        const target = prev.find(
          (x) => normalizeId(x?._id || x?.id) === deletedId,
        );

        if (!target) return prev;

        removedAny = true;
        removedUnread = !isItemRead(target);

        return prev.filter((x) => normalizeId(x?._id || x?.id) !== deletedId);
      });

      if (removedAny) {
        setTotal((count) => Math.max(0, Number(count || 0) - 1));
      }

      if (removedUnread) {
        setUnread((count) => Math.max(0, Number(count || 0) - 1));
      }
    };

    const onUnreadCount = (payload) => {
      const nextUnread = Number(
        payload?.unread ??
          payload?.unreadCount ??
          payload?.count ??
          payload?.totalUnread,
      );

      if (Number.isFinite(nextUnread)) {
        setUnread(nextUnread);
      } else {
        void loadUnread();
      }
    };

    socket.on("notification:new", onNewNotification);
    socket.on("notification:created", onNotificationCreated);
    socket.on("notification:update", onNotificationUpdated);
    socket.on("notification:updated", onNotificationUpdated);
    socket.on("notification:read", onNotificationRead);
    socket.on("notification:deleted", onNotificationDeleted);
    socket.on("notification:delete", onNotificationDeleted);
    socket.on("notification:badge:update", onUnreadCount);
    socket.on("notification:badge", onUnreadCount);
    socket.on("notification:unread-count", onUnreadCount);

    void loadNotifications({ page: 1, limit: 20 });
    void loadUnread();

    return () => {
      socket.off("notification:new", onNewNotification);
      socket.off("notification:created", onNotificationCreated);
      socket.off("notification:update", onNotificationUpdated);
      socket.off("notification:updated", onNotificationUpdated);
      socket.off("notification:read", onNotificationRead);
      socket.off("notification:deleted", onNotificationDeleted);
      socket.off("notification:delete", onNotificationDeleted);
      socket.off("notification:badge:update", onUnreadCount);
      socket.off("notification:badge", onUnreadCount);
      socket.off("notification:unread-count", onUnreadCount);

      if (joinedRef.current) {
        try {
          const prev = currentIdentityRef.current || {};

          socket.emit("user:leave", {
            userId: prev.userId,
            academyId: prev.academyId,
            role: prev.role,
          });

          socket.emit("notification:leave", {
            userId: prev.userId,
            academyId: prev.academyId,
            role: prev.role,
          });
        } catch {
          // ignore
        }

        joinedRef.current = false;
      }
    };
  }, [
    userId,
    academyId,
    role,
    prependNotification,
    replaceNotification,
    loadUnread,
    loadNotifications,
  ]);

  const value = useMemo(
    () => ({
      items,
      rows: items,
      notifications: items,

      unread,
      unreadCount: unread,
      count: unread,
      hasUnread: unread > 0,

      total,
      page,
      pages,

      loading,
      loadingUnread,
      busy,

      error,
      err: error,

      loadUnread,
      loadNotifications,
      load: loadNotifications,
      reloadCurrent,
      refresh: reloadCurrent,

      markRead,
      markUnread,
      markAllRead,
      bulkRead,

      deleteNotification,
      remove: deleteNotification,

      prependNotification,
      replaceNotification,

      setItems,
      setUnread,
      setPage,
      setPages,
      setTotal,
      setError,
    }),
    [
      items,
      unread,
      total,
      page,
      pages,
      loading,
      loadingUnread,
      busy,
      error,
      loadUnread,
      loadNotifications,
      reloadCurrent,
      markRead,
      markUnread,
      markAllRead,
      bulkRead,
      deleteNotification,
      prependNotification,
      replaceNotification,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);

  if (!ctx) {
    throw new Error(
      "useNotificationsContext must be used inside NotificationsProvider",
    );
  }

  return ctx;
}

export default NotificationsProvider;
