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
        <header className="h-16 flex items-center justify-between px-6 bg-bg-card border-b border-border-main shrink-0 sticky top-0 z-20 premium-shadow">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="md:hidden p-2 rounded-lg hover:bg-bg-main text-text-muted transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="flex flex-col">
                    <h2 className="text-sm font-black text-text-main uppercase tracking-widest leading-none mb-0.5">{title}</h2>
                    <p className="text-[10px] font-bold text-text-muted hidden md:block">DTA ERP System Interface</p>
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-7">
                {/* Desktop Search */}
                <div className="hidden lg:flex relative group w-80">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-text-muted text-[18px] group-focus-within:text-primary transition-colors">search</span>
                    </div>
                    <input
                        className="block w-full pl-10 pr-4 py-2 bg-bg-main border-2 border-transparent rounded-xl text-[11px] font-bold placeholder-text-muted/40 text-text-main focus:outline-none focus:bg-bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all duration-300"
                        placeholder="SEARCH EVERYTHING..."
                        type="text"
                    />
                </div>

                <div className="flex items-center gap-1 relative" ref={dropdownRef}>
                    <button
                        onClick={toggleNotifications}
                        className="p-2 rounded-xl hover:bg-bg-main text-text-muted relative transition-all duration-300 group"
                        title="Notifications"
                    >
                        <span className="material-symbols-outlined text-[24px] group-hover:scale-110">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 size-4 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-bg-card shadow-sm animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showDropdown && (
                        <div className="absolute right-0 top-14 w-[380px] bg-bg-card border border-border-main rounded-3xl shadow-2xl overflow-hidden z-50 premium-card">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main bg-bg-main">
                                <div>
                                    <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Notifications</p>
                                    <p className="text-[10px] text-text-muted font-bold mt-0.5">Live updates stream</p>
                                </div>
                                <button
                                    onClick={handleClearAll}
                                    className="text-[9px] font-black text-red-500 uppercase tracking-tighter hover:underline"
                                >
                                    Clear all
                                </button>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto">
                                {loadingNotifications ? (
                                    <div className="p-8 text-center text-text-muted text-[11px] font-black uppercase tracking-widest animate-pulse">Loading...</div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-10 text-center flex flex-col items-center">
                                        <span className="material-symbols-outlined text-border-main text-[48px] mb-3">notifications_off</span>
                                        <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`border-b border-border-main last:border-0 px-5 py-5 hover:bg-bg-main transition-all duration-300 ${!notification.is_read ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`size-9 rounded-xl flex items-center justify-center border ${!notification.is_read ? 'bg-primary text-white border-primary/20 shadow-lg shadow-primary/20' : 'bg-bg-main text-text-muted border-border-main'}`}>
                                                    <span className="material-symbols-outlined text-[18px]">notifications</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div>
                                                            <p className="text-[11px] font-black text-text-main uppercase tracking-tight">{notification.title}</p>
                                                            <p className="text-xs text-text-main font-medium mt-1 leading-relaxed opacity-80">{notification.message}</p>
                                                        </div>
                                                        <span className="text-[9px] text-text-muted font-black uppercase tracking-tighter opacity-60">{formatRelativeTime(notification.created_at)}</span>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {!notification.is_read && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="px-4 py-1.5 rounded-lg bg-primary text-white text-[9px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all"
                                                            >
                                                                Mark read
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(notification.id)}
                                                            className="px-4 py-1.5 rounded-lg bg-bg-main border border-border-main text-text-muted text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
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

                            <div className="flex items-center justify-between px-6 py-4 border-t border-border-main bg-bg-main">
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                                >
                                    Mark all as read
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDropdown(false);
                                        navigate('/notifications');
                                    }}
                                    className="bg-text-main text-bg-card text-[9px] font-black uppercase tracking-widest px-6 py-2 rounded-full hover:bg-primary hover:text-white transition-all shadow-md"
                                >
                                    View all stream
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-6 w-[1px] bg-border-main mx-2 hidden md:block"></div>

                    <button
                        onClick={() => navigate('/help-demo')}
                        className="hidden md:flex p-2 rounded-xl hover:bg-bg-main text-text-muted transition-all duration-300 hover:scale-110"
                        title="Help"
                    >
                        <span className="material-symbols-outlined text-[22px]">help</span>
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="hidden md:flex p-2 rounded-xl hover:bg-bg-main text-text-muted transition-all duration-300 hover:scale-110"
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {theme === 'light' ? 'dark_mode' : 'light_mode'}
                        </span>
                    </button>
                    <button
                        onClick={() => navigate('/settings')}
                        className="hidden md:flex p-2 rounded-xl hover:bg-bg-main text-text-muted transition-all duration-300 hover:scale-110"
                        title="Settings"
                    >
                        <span className="material-symbols-outlined text-[22px]">settings</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;

