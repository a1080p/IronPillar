import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { FriendRequest, Post, PostComment } from '../types/models';

// Friend requests sent to you (incoming) and by you (outgoing).
export function useFriendRequests(uid: string | undefined) {
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!uid) return;
    const unsubIn = onSnapshot(
      collection(db, 'friendRequests', uid, 'incoming'),
      (snap) => setIncoming(snap.docs.map((d) => d.data() as FriendRequest)),
      () => setIncoming([])
    );
    const unsubOut = onSnapshot(
      collection(db, 'friendRequests', uid, 'outgoing'),
      (snap) => setOutgoing(snap.docs.map((d) => d.data() as FriendRequest)),
      () => setOutgoing([])
    );
    return () => {
      unsubIn();
      unsubOut();
    };
  }, [uid]);

  return { incoming, outgoing };
}

// One post, live. `missing` once it's known not to exist or isn't visible.
export function usePost(postId: string | undefined) {
  const [post, setPost] = useState<Post | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!postId) return;
    return onSnapshot(
      doc(db, 'posts', postId),
      (snap) => {
        setPost(snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null);
        setMissing(!snap.exists());
      },
      () => setMissing(true)
    );
  }, [postId]);

  return { post, missing };
}

export function useComments(postId: string | undefined) {
  const [comments, setComments] = useState<PostComment[]>([]);

  useEffect(() => {
    if (!postId) return;
    return onSnapshot(
      query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc')),
      (snap) => setComments(snap.docs.map((d) => d.data() as PostComment)),
      () => setComments([])
    );
  }, [postId]);

  return comments;
}
