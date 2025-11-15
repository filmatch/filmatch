import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { NotificationService, type Notification } from '../services/NotificationService';

const fmtTime = (timestamp: any) => {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  
  const days = Math.floor(diffMins / 1440);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  
  return date.toLocaleDateString();
};

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const currentUser = FirebaseAuthService.getCurrentUser();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    console.log('Setting up notification listener for user:', currentUser.uid);

    // Set up real-time listener
    const unsubscribe = NotificationService.listenToNotifications(
      currentUser.uid,
      (newNotifications) => {
        console.log('Received notifications:', newNotifications.length);
        setNotifications(newNotifications);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => {
      console.log('Cleaning up notification listener');
      unsubscribe();
    };
  }, [currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await NotificationService.markAsRead(notification.id);
    }

    if (notification.type === 'match' && notification.data?.chatId) {
      navigation.navigate('Chats');
    } else if (notification.type === 'message' && notification.data?.chatId) {
      navigation.navigate('Chat', { chatId: notification.data.chatId });
    }
  };

  const handleDeleteNotification = (notificationId: string) => {
    Alert.alert(
      'Delete notification',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await NotificationService.deleteNotification(notificationId);
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;

    Alert.alert(
      'Clear all',
      'Delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            if (currentUser) {
              await NotificationService.deleteAllNotifications(currentUser.uid);
            }
          },
        },
      ]
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => handleDeleteNotification(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {item.data?.fromUserPhoto ? (
              <Image source={{ uri: item.data.fromUserPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {item.data?.fromUserName?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {!item.read && <View style={styles.unreadDot} />}
          </View>

          {/* Content */}
          <View style={styles.textContent}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.notificationTime}>{fmtTime(item.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F0E4C1" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Unread count */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyText}>
            you'll see notifications here when you get matches or messages.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F0E4C1"
              colors={['#F0E4C1']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111C2A',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#F0E4C1',
    opacity: 0.7,
    marginTop: 12,
    textTransform: 'lowercase',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.1)',
  },
  headerTitle: {
    color: '#F0E4C1',
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(240,228,193,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.2)',
  },
  clearButtonText: {
    color: '#F0E4C1',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  unreadBanner: {
    backgroundColor: '#511619',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.1)',
  },
  unreadText: {
    color: '#F0E4C1',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  listContent: {
    padding: 12,
  },

  notificationCard: {
    backgroundColor: 'rgba(240,228,193,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.1)',
    padding: 14,
    marginBottom: 10,
  },
  unreadCard: {
    backgroundColor: 'rgba(81,22,25,0.2)',
    borderColor: 'rgba(240,228,193,0.2)',
  },

  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(240,228,193,0.1)',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'rgba(240,228,193,0.6)',
    fontSize: 18,
    fontWeight: '700',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#511619',
    borderWidth: 2,
    borderColor: '#111C2A',
  },

  textContent: {
    flex: 1,
  },
  notificationTitle: {
    color: '#F0E4C1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  notificationMessage: {
    color: 'rgba(240,228,193,0.85)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
    textTransform: 'lowercase',
  },
  notificationTime: {
    color: 'rgba(240,228,193,0.6)',
    fontSize: 12,
    textTransform: 'lowercase',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#F0E4C1',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'lowercase',
  },
  emptyText: {
    color: 'rgba(240,228,193,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    textTransform: 'lowercase',
  },
});
