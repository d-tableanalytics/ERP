import { useState, useEffect } from 'react';

const usePermissions = () => {
    const [userId, setUserId] = useState(null);
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const uid = stored?.user?.id || stored?.id || null;
        const urole = stored?.user?.role || stored?.role || 'user';
        setUserId(uid);
        setRole(urole.toUpperCase());
        setLoading(false);
    }, []);

    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

    const can = (category, action) => {
        if (isAdmin) return true;
        // Default permit everything for now in the simplified ERP version
        // unless you want to implement specific checks.
        return true;
    };

    const canOnOwn = (category, action, ownerId) => {
        if (isAdmin) return true;
        if (userId && ownerId && String(userId) === String(ownerId)) return true;
        return can(category, action);
    };

    return { can, canOnOwn, isAdmin, roleName: role, userId, loading };
};

export default usePermissions;
