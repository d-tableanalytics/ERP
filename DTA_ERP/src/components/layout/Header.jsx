import { useDispatch, useSelector } from 'react-redux';
import { setTheme, updateUserTheme } from '../../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import notificationService from '../../services/notificationService';

const Header = ({ title = "Dashboard Overview", onMenuClick }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { theme, token } = useSelector((state) => state.auth);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const dropdownRef = useRef(null);

    const getUnreadCount = (items) => (
        Array.isArray(items) ? items.filter((notification) => !notification.is_read).length : 0
    );

    useEffect(() => {
        fetchUnreadCount();

        const handleWindowFocus = () => {
            fetchUnreadCount();
        };

        const refreshTimer = window.setInterval(fetchUnreadCount, 30000);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.clearInterval(refreshTimer);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    const fetchUnreadCount = async () => {
        try {
            const data = await notificationService.getNotifications();
            setUnreadCount(getUnreadCount(data));
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const fetchDropdownNotifications = async () => {
        try {
            setLoadingNotifications(true);
            const data = await notificationService.getNotifications();
            setNotifications(Array.isArray(data) ? data.slice(0, 6) : []);
            setUnreadCount(getUnreadCount(data));
        } catch (error) {
            console.error('Error fetching dropdown notifications:', error);
        } finally {
            setLoadingNotifications(false);
        }
    };

    const toggleNotifications = async () => {
        setShowDropdown((prev) => !prev);
        if (!showDropdown) {
            await fetchDropdownNotifications();
        }
    };

    const toggleTheme = () => {
        const nextTheme = theme === 'light' ? 'dark' : 'light';
        dispatch(setTheme(nextTheme));

        if (token) {
            dispatch(updateUserTheme(nextTheme));
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const handleClearAll = async () => {
        try {
            await notificationService.clearAll();
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            const targetNotification = notifications.find((n) => n.id === id);
            await notificationService.markAsRead(id);
            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
            if (targetNotification && !targetNotification.is_read) {
                setUnreadCount((prevCount) => Math.max(prevCount - 1, 0));
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            const targetNotification = notifications.find((n) => n.id === id);
            await notificationService.deleteNotification(id);
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            if (targetNotification && !targetNotification.is_read) {
                setUnreadCount((prevCount) => Math.max(prevCount - 1, 0));
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const formatRelativeTime = (createdAt) => {
        const date = new Date(createdAt);
        const diff = Date.now() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <header className="h-16 flex items-center justify-between px-6 bg-bg-card border-b border-border-main shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="md:hidden p-2 rounded-lg hover:bg-bg-main text-text-muted transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h2 className="text-lg font-bold text-text-main tracking-tight">{title}</h2>
            </div>

            <div className="flex items-center gap-4 md:gap-7">
                {/* Desktop Search */}
                <div className="hidden lg:flex relative group w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-text-muted text-[20px] group-focus-within:text-primary transition-colors">search</span>
                    </div>
                    <input
                        className="block w-full pl-10 pr-3 py-2 border border-border-main rounded-xl bg-bg-main text-sm placeholder-text-muted/50 text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Search modules, tasks, files..."
                        type="text"
                    />
                </div>

                <div className="flex items-center gap-1.5 relative" ref={dropdownRef}>
                    <button
                        onClick={toggleNotifications}
                        className="p-2 rounded-xl hover:bg-bg-main text-text-muted relative transition-colors"
                        title="Notifications"
                    >
                        <span className="material-symbols-outlined text-[24px]">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-bg-card">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showDropdown && (
                        <div className="absolute right-0 top-14 w-[360px] bg-bg-card border border-border-main rounded-3xl shadow-xl overflow-hidden z-50">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border-main bg-bg-main">
                                <div>
                                    <p className="text-sm font-bold text-text-main">Notifications</p>
                                    <p className="text-xs text-text-muted">Recent updates</p>
                                </div>
                                <button
                                    onClick={handleClearAll}
                                    className="text-xs font-semibold text-red-500 hover:underline"
                                >
                                    Clear all
                                </button>
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                                {loadingNotifications ? (
                                    <div className="p-5 text-center text-text-muted">Loading...</div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-6 text-center text-text-muted">No notifications yet</div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`border-b border-border-main last:border-0 px-4 py-4 hover:bg-bg-main/60 transition-colors ${!notification.is_read ? 'bg-blue-50' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-base">notifications</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div>
                                                            <p className="text-sm font-bold text-text-main">{notification.title}</p>
                                                            <p className="text-xs text-text-muted mt-1">{notification.message}</p>
                                                        </div>
                                                        <span className="text-[10px] text-text-muted whitespace-nowrap">{formatRelativeTime(notification.created_at)}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                                        {!notification.is_read && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="px-3 py-1 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
                                                            >
                                                                Mark as read
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(notification.id)}
                                                            className="px-3 py-1 rounded-full bg-bg-main border border-border-main text-text-muted hover:bg-gray-100 transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center justify-between px-4 py-3 border-t border-border-main bg-bg-main">
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs font-semibold text-primary hover:underline"
                                >
                                    Mark all as read
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDropdown(false);
                                        navigate('/notifications');
                                    }}
                                    className="bg-primary text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-primary/90 transition-colors"
                                >
                                    View all
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/help-demo')}
                        className="hidden md:block p-2 rounded-xl hover:bg-bg-main text-text-muted transition-colors"
                        title="Help"
                    >
                        <span className="material-symbols-outlined text-[24px]">help</span>
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="hidden md:block p-2 rounded-xl hover:bg-bg-main text-text-muted transition-colors"
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        <span className="material-symbols-outlined text-[24px]">
                            {theme === 'light' ? 'dark_mode' : 'light_mode'}
                        </span>
                    </button>
                    <button
                        onClick={() => navigate('/settings')}
                        className="hidden md:block p-2 rounded-xl hover:bg-bg-main text-text-muted transition-colors"
                        title="Settings"
                    >
                        <span className="material-symbols-outlined text-[24px]">settings</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
