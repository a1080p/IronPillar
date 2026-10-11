// In-app notifications: an inbox (the bell in the top bar) plus a banner that
// slides in while the app is open. Built from data the app already listens
// to — the activity feed and incoming friend requests — plus a local
// "streak at risk" nudge. Read state is per device. The reminders that fire
// while the app is closed (lib/reminders.ts) are separate and unchanged.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { todayDateString, yesterdayDateString } from '../constants/gamification';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useFriendRequests } from '../hooks/useSocial';
import { useActiveStreak } from '../hooks/useActiveStreak';
import { useAuth } from './AuthContext';
import type { ActivityFeedItem } from '../types/models';

export type NotificationKind =
  | 'friend_request'
  | 'friend_request_accepted'
  | 'reaction'
  | 'comment'
  | 'badge_earned'
  | 'streak_milestone'
  | 'streak_at_risk';

export interface InAppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string; // ISO timestamp
  href: Href;
}

interface NotificationsContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  isUnread: (n: InAppNotification) => boolean;
  markAllSeen: () => void;
  banner: InAppNotification | null;
  dismissBanner: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

// Feed items that are about you (or a friend's milestone), not your own posts.
const FEED_KINDS: Partial<Record<ActivityFeedItem['type'], NotificationKind>> = {
  reaction: 'reaction',
  comment: 'comment',
  friend_request_accepted: 'friend_request_accepted',
  badge_earned: 'badge_earned',
  streak_milestone: 'streak_milestone',
};

const FEED_TITLES: Record<string, string> = {
  reaction: 'New reaction',
  comment: 'New comment',
  friend_request_accepted: 'Friend request accepted',
  badge_earned: 'Badge earned',
  streak_milestone: 'Streak milestone',
};

// From this hour, someone who trained yesterday but not yet today is told
// their streak ends at midnight.
const STREAK_AT_RISK_HOUR = 17;
const lastSeenKey = (uid: string) => `notifications.lastSeenAt.${uid}`;

function fromFeed(item: ActivityFeedItem, uid: string): InAppNotification | null {
  const kind = FEED_KINDS[item.type];
  if (!kind || item.actorUid === uid) return null;
  const href: Href =
    item.postId && (kind === 'reaction' || kind === 'comment')
      ? (`/post/${item.postId}` as Href)
      : kind === 'badge_earned' || kind === 'streak_milestone' || kind === 'friend_request_accepted'
        ? (`/friend/${item.actorUid}` as Href)
        : ('/social' as Href);
  return {
    id: `feed-${item.id}`,
    kind,
    title: FEED_TITLES[kind] ?? 'Iron Pillar',
    body: item.message,
    createdAt: item.createdAt,
    href,
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const uid = profile ? user?.uid : undefined;
  const { items } = useActivityFeed(uid);
  const { incoming } = useFriendRequests(uid);
  const streak = useActiveStreak();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [lastSeenLoaded, setLastSeenLoaded] = useState(false);
  const [banner, setBanner] = useState<InAppNotification | null>(null);
  // Only things that arrive after the app opened get a banner.
  const openedAt = useRef(new Date().toISOString());
  const bannered = useRef(new Set<string>());

  useEffect(() => {
    if (!uid) return;
    setLastSeenLoaded(false);
    AsyncStorage.getItem(lastSeenKey(uid))
      .catch(() => null)
      .then((value) => {
        setLastSeenAt(value);
        setLastSeenLoaded(true);
      });
  }, [uid]);

  const notifications = useMemo(() => {
    if (!uid) return [];
    const list: InAppNotification[] = [];
    for (const r of incoming) {
      list.push({
        id: `request-${r.uid}`,
        kind: 'friend_request',
        title: 'Friend request',
        body: `${r.name} (@${r.username}) wants to be friends.`,
        createdAt: r.createdAt,
        href: '/social' as Href,
      });
    }
    for (const item of items) {
      const n = fromFeed(item, uid);
      if (n) list.push(n);
    }
    const now = new Date();
    if (
      streak > 0 &&
      profile?.lastWorkoutDate === yesterdayDateString(now) &&
      now.getHours() >= STREAK_AT_RISK_HOUR
    ) {
      const at = new Date(now);
      at.setHours(STREAK_AT_RISK_HOUR, 0, 0, 0);
      list.push({
        id: `streak-risk-${todayDateString(now)}`,
        kind: 'streak_at_risk',
        title: `Keep your ${streak}-day streak 🔥`,
        body: 'No workout yet today. Get 30 minutes in before midnight to keep it going.',
        createdAt: at.toISOString(),
        href: '/' as Href,
      });
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [uid, items, incoming, streak, profile?.lastWorkoutDate]);

  const isUnread = (n: InAppNotification) => !lastSeenAt || n.createdAt > lastSeenAt;
  const unreadCount = lastSeenLoaded ? notifications.filter(isUnread).length : 0;

  // Banner the newest unread arrival since the app opened.
  useEffect(() => {
    if (!lastSeenLoaded) return;
    const fresh = notifications.find(
      (n) =>
        isUnread(n) &&
        (n.createdAt > openedAt.current || n.kind === 'streak_at_risk') &&
        !bannered.current.has(n.id)
    );
    if (fresh) {
      bannered.current.add(fresh.id);
      setBanner(fresh);
    }
  }, [notifications, lastSeenLoaded]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    isUnread,
    markAllSeen: () => {
      if (!uid) return;
      const now = new Date().toISOString();
      setLastSeenAt(now);
      AsyncStorage.setItem(lastSeenKey(uid), now).catch(() => {});
    },
    banner,
    dismissBanner: () => setBanner(null),
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
