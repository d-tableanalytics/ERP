import { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import notificationService from '../../services/notificationService';
import toast from 'react-hot-toast';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getNotifications();
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === id ? { ...notif, is_read: true } : notif
                )
            );
            toast.success('Notification marked as read');
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark as read');
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev =>
                prev.map(notif => ({ ...notif, is_read: true }))
            );
            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        }
    };

    const deleteNotification = async (id) => {
        try {
            await notificationService.deleteNotification(id);
            setNotifications(prev => prev.filter(notif => notif.id !== id));
            toast.success('Notification deleted');
        } catch (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
        }
    };

    const clearAll = async () => {
        try {
            await notificationService.clearAll();
            setNotifications([]);
            toast.success('All notifications cleared');
        } catch (error) {
            console.error('Error clearing notifications:', error);
            toast.error('Failed to clear notifications');
        }
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'unread') return !notif.is_read;
        return true;
    });

    const getNotificationIcon = (type) => {
        const t = type?.toUpperCase();
        if (t?.includes('TASK_CREATED')) return 'add_task';
        if (t?.includes('TASK_UPDATED')) return 'edit_notifications';
        if (t?.includes('TASK_COMPLETED')) return 'task_alt';
        if (t?.includes('TASK_DELETED')) return 'delete_sweep';
        if (t?.includes('TASK_REMINDER')) return 'notifications_active';
        if (t?.includes('TASK_DUE_SOON')) return 'running_with_errors';
        
        switch (type) {
            case 'task': return 'task';
            case 'delegation': return 'assignment';
            case 'help_ticket': return 'help';
            case 'system': return 'settings';
            default: return 'notifications';
        }
    };

    const getNotificationColor = (type) => {
        const t = type?.toUpperCase();
        if (t?.includes('CREATED')) return 'bg-blue-100 text-blue-600';
        if (t?.includes('UPDATED')) return 'bg-amber-100 text-amber-600';
        if (t?.includes('COMPLETED')) return 'bg-green-100 text-green-600';
        if (t?.includes('DELETED')) return 'bg-red-100 text-red-600';
        if (t?.includes('REMINDER')) return 'bg-indigo-100 text-indigo-600';
        if (t?.includes('DUE')) return 'bg-orange-100 text-orange-600';

        switch (type) {
            case 'task': return 'bg-blue-100 text-blue-600';
            case 'delegation': return 'bg-green-100 text-green-600';
            case 'help_ticket': return 'bg-orange-100 text-orange-600';
            case 'system': return 'bg-purple-100 text-purple-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <MainLayout title="Notifications">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Notifications">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                                filter === 'all'
                                    ? 'bg-primary text-white'
                                    : 'bg-bg-card border border-border-main text-text-muted hover:bg-bg-main'
                            }`}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                                filter === 'unread'
                                    ? 'bg-primary text-white'
                                    : 'bg-bg-card border border-border-main text-text-muted hover:bg-bg-main'
                            }`}
                        >
                            Unread ({notifications.filter(n => !n.is_read).length})
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {notifications.some(n => !n.is_read) && (
                            <button
                                onClick={markAllAsRead}
                                className="text-primary text-xs font-bold hover:underline"
                            >
                                Mark all as read
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="text-red-500 text-xs font-bold hover:underline"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm">
                    {filteredNotifications.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">
                            <span className="material-symbols-outlined text-4xl mb-4">notifications_off</span>
                            <p>No notifications to show</p>
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`flex gap-4 p-4 border-b border-border-main last:border-0 hover:bg-bg-main/50 transition-colors cursor-pointer group ${
                                    !notification.is_read ? 'bg-blue-50/50' : ''
                                }`}
                                onClick={() => !notification.is_read && markAsRead(notification.id)}
                            >
                                <div
                                    className={`size-10 rounded-full flex items-center justify-center shrink-0 ${getNotificationColor(notification.type)}`}
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {getNotificationIcon(notification.type)}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">
                                            {notification.title}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-text-muted">
                                                {formatTime(notification.created_at)}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-text-muted mt-0.5">{notification.message}</p>
                                </div>
                                {!notification.is_read && (
                                    <div className="size-2 rounded-full bg-primary mt-2 shrink-0"></div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default Notifications;
