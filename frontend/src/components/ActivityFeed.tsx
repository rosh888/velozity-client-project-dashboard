import { useActivityFeed } from "../hooks/useActivityFeed";
import { timeAgo } from "../utils/timeAgo";

export function ActivityFeed({ projectId, taskId }: { projectId?: string; taskId?: string }) {
  const { events, loading } = useActivityFeed({ projectId, taskId });

  if (loading) return <p className="muted">Loading activity…</p>;
  if (events.length === 0) return <p className="muted">No activity yet.</p>;

  return (
    <div>
      {events.map((e) => (
        <div key={e.id} className="activity-item">
          <div>{e.message}</div>
          <div className="time">{timeAgo(e.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
