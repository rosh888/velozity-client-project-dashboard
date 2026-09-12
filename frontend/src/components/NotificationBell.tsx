import { useState } from "react";
import { useNotifications } from "../notifications/NotificationsContext";
import { timeAgo } from "../utils/timeAgo";

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="notif-wrapper">
      <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
        Notifications
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px" }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <button className="btn btn-sm" onClick={() => markAllRead()}>
              Mark all read
            </button>
          </div>
          {notifications.length === 0 && (
            <div className="notif-item muted">No notifications yet</div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.isRead ? "" : "unread"}`}
              onClick={() => !n.isRead && markRead(n.id)}
              style={{ cursor: n.isRead ? "default" : "pointer" }}
            >
              <div>{n.message}</div>
              <div className="muted">{timeAgo(n.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
