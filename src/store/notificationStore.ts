import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationType, NotificationPreferences, DefaultNotificationPreferences } from '@/models/Notification';

interface NotificationState {
  // State
  notifications: Notification[];
  preferences: NotificationPreferences;
  unreadCount: number;
  lastChecked: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'isRead' | 'timestamp'>) => string;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  updatePreferences: (newPreferences: Partial<NotificationPreferences>) => void;
  updateLastChecked: () => void;
  
  // Helpers
  getUnreadNotifications: () => Notification[];
  getNotificationsByType: (type: NotificationType) => Notification[];
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      preferences: DefaultNotificationPreferences,
      unreadCount: 0,
      lastChecked: Date.now(),

      addNotification: (notification) => {
        const { preferences } = get();
        
        // Don't add notification if preference for this type is disabled
        if (preferences && notification.type in preferences) {
          const prefKey = notification.type as keyof NotificationPreferences;
          if (!preferences[prefKey]) {
            return '';
          }
        }
        
        const id = uuidv4();
        const newNotification: Notification = {
          ...notification,
          id,
          isRead: false,
          timestamp: Date.now()
        };
        
        set((state) => {
          const newNotifications = [newNotification, ...state.notifications];
          return {
            notifications: newNotifications,
            unreadCount: state.unreadCount + 1
          };
        });
        
        return id;
      },
      
      markAsRead: (notificationId) => {
        set((state) => {
          const notificationIndex = state.notifications.findIndex(
            (notification) => notification.id === notificationId
          );
          
          if (notificationIndex === -1) return state;
          
          const notification = state.notifications[notificationIndex];
          if (notification.isRead) return state;
          
          const updatedNotifications = [...state.notifications];
          updatedNotifications[notificationIndex] = {
            ...notification,
            isRead: true
          };
          
          return {
            notifications: updatedNotifications,
            unreadCount: Math.max(0, state.unreadCount - 1)
          };
        });
      },
      
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((notification) => ({
            ...notification,
            isRead: true
          })),
          unreadCount: 0,
        }));
      },
      
      removeNotification: (notificationId) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === notificationId);
          const newUnreadCount = notification && !notification.isRead
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount;
            
          return {
            notifications: state.notifications.filter(n => n.id !== notificationId),
            unreadCount: newUnreadCount
          };
        });
      },
      
      clearAllNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },
      
      updatePreferences: (newPreferences) => {
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences }
        }));
      },
      
      updateLastChecked: () => {
        set({ lastChecked: Date.now() });
      },
      
      getUnreadNotifications: () => {
        return get().notifications.filter(notification => !notification.isRead);
      },
      
      getNotificationsByType: (type) => {
        return get().notifications.filter(notification => notification.type === type);
      }
    }),
    {
      name: 'ipfs-x-notifications',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        preferences: state.preferences,
        lastChecked: state.lastChecked
      })
    }
  )
); 