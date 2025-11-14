// src/services/NotificationService.ts
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';

export type NotificationType = 'match' | 'message' | 'like';

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  data?: {
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
    chatId?: string;
    matchId?: string;
    messageCount?: number;
  };
};

export class NotificationService {
  private static db = getFirestore();

  /**
   * Create match notifications for BOTH users when they match
   */
  static async createMatchNotifications(
    user1Id: string,
    user1Name: string,
    user1Photo: string | undefined,
    user2Id: string,
    user2Name: string,
    user2Photo: string | undefined,
    chatId: string
  ): Promise<void> {
    try {
      const notificationsRef = collection(this.db, 'notifications');
      
      // Create notification for user1 (about user2)
      await addDoc(notificationsRef, {
        userId: user1Id,
        type: 'match',
        title: '🎉 New Match!',
        message: `You matched with ${user2Name}`,
        read: false,
        createdAt: serverTimestamp(),
        data: {
          fromUserId: user2Id,
          fromUserName: user2Name,
          fromUserPhoto: user2Photo || null,
          chatId,
          matchId: `match_${[user1Id, user2Id].sort().join('_')}`,
        },
      });

      // Create notification for user2 (about user1)
      await addDoc(notificationsRef, {
        userId: user2Id,
        type: 'match',
        title: '🎉 New Match!',
        message: `You matched with ${user1Name}`,
        read: false,
        createdAt: serverTimestamp(),
        data: {
          fromUserId: user1Id,
          fromUserName: user1Name,
          fromUserPhoto: user1Photo || null,
          chatId,
          matchId: `match_${[user1Id, user2Id].sort().join('_')}`,
        },
      });

      console.log('✅ Match notifications created successfully');
    } catch (error) {
      console.error('❌ Error creating match notifications:', error);
      throw error;
    }
  }

  /**
   * Create a message notification (only for first message in chat)
   * Subsequent messages update the existing notification
   */
  static async createMessageNotification(
    recipientId: string,
    senderId: string,
    senderName: string,
    senderPhoto: string | undefined,
    messageText: string,
    chatId: string
  ): Promise<void> {
    try {
      const notificationsRef = collection(this.db, 'notifications');
      
      // Check if there's already a message notification for this chat
      const q = query(
        notificationsRef,
        where('userId', '==', recipientId),
        where('type', '==', 'message'),
        where('data.chatId', '==', chatId)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // First message - create notification (appears in notifications tab)
        await addDoc(notificationsRef, {
          userId: recipientId,
          type: 'message',
          title: `💬 ${senderName}`,
          message: messageText,
          read: false,
          createdAt: serverTimestamp(),
          data: {
            fromUserId: senderId,
            fromUserName: senderName,
            fromUserPhoto: senderPhoto || null,
            chatId,
            messageCount: 1,
          },
        });
        console.log('✅ First message notification created');
      } else {
        // Subsequent messages - update existing notification (stack messages)
        const existingNotif = snapshot.docs[0];
        const existingData = existingNotif.data();
        const currentCount = existingData.data?.messageCount || 1;
        
        await updateDoc(existingNotif.ref, {
          message: currentCount === 1 
            ? `${senderName} sent 2 messages` 
            : `${senderName} sent ${currentCount + 1} messages`,
          read: false, // Mark as unread again
          createdAt: serverTimestamp(), // Update timestamp to move to top
          'data.messageCount': currentCount + 1,
        });
        console.log('✅ Message notification updated (stacked)');
      }
    } catch (error) {
      console.error('❌ Error creating message notification:', error);
    }
  }

  /**
   * Listen to notifications for a specific user (real-time)
   */
  static listenToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void
  ): () => void {
    try {
      const notificationsRef = collection(this.db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const notifications: Notification[] = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            notifications.push({
              id: doc.id,
              userId: data.userId,
              type: data.type,
              title: data.title,
              message: data.message,
              read: data.read || false,
              createdAt: data.createdAt,
              data: data.data || {},
            });
          });

          callback(notifications);
        },
        (error) => {
          console.error('Error listening to notifications:', error);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up notification listener:', error);
      return () => {}; // Return empty function if setup fails
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(this.db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(this.db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(q);
      
      const updatePromises = snapshot.docs.map((doc) =>
        updateDoc(doc.ref, { read: true })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(this.db, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteAllNotifications(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(this.db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', userId));

      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));

      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  }

  /**
   * Clear message notification for a specific chat when user opens it
   */
  static async clearChatNotification(userId: string, chatId: string): Promise<void> {
    try {
      const notificationsRef = collection(this.db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('type', '==', 'message'),
        where('data.chatId', '==', chatId)
      );

      const snapshot = await getDocs(q);
      
      // Delete all message notifications for this chat
      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log('✅ Chat notification cleared');
    } catch (error) {
      console.error('Error clearing chat notification:', error);
    }
  }
}