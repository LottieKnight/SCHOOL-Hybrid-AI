"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { Card, CardBody } from "@/components/ui/Card";
import styles from "./page.module.css";

type Notification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then(res => res.json())
      .then(d => {
        setNotifications(d.notifications ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markRead = (id?: string) => {
    fetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ id }),
    }).then(() => {
      setNotifications(prev => 
        prev.map(n => (!id || n.id === id ? { ...n, is_read: true } : n))
      );
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <RouteHeader title="Notifications" description="Stay updated with your academic community." />
        <button className={styles.markAllBtn} onClick={() => markRead()}>Mark all as read</button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <p className={styles.empty}>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p className={styles.empty}>You're all caught up! No new notifications.</p>
        ) : (
          notifications.map((n) => (
            <Card key={n.id} className={styles.notificationCard} data-read={n.is_read}>
              <CardBody className={styles.cardBody}>
                <div className={styles.typeIcon}>{getTypeEmoji(n.type)}</div>
                <div className={styles.content}>
                  <h4 className={styles.notifTitle}>{n.title}</h4>
                  <p className={styles.notifMessage}>{n.message}</p>
                  <span className={styles.time}>{new Date(n.created_at).toLocaleString()}</span>
                </div>
                {n.link && (
                  <Link href={n.link} className={styles.viewBtn} onClick={() => markRead(n.id)}>View</Link>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function getTypeEmoji(type: string) {
  switch (type) {
    case 'mention': return '💬';
    case 'badge': return '🏆';
    case 'streak': return '🔥';
    case 'reminder': return '⏰';
    case 'answer_accepted': return '✅';
    case 'same_question_resolved': return '💡';
    case 'comment_on_post': return '💬';
    case 'reaction_on_post': return '⚡';
    case 'achievement_unlocked': return '🏅';
    case 'weekly_wrap': return '📊';
    case 'follow': return '👤';
    default: return '📢';
  }
}
