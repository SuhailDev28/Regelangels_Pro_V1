import { useNotificationsContext } from "../pages/Components/notifications/NotificationsProvider.jsx";

export function useNotifications() {
  return useNotificationsContext();
}

export default useNotifications;
