import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../../store/slices/authSlice";

const Sidebar = ({ isCollapsed, setIsCollapsed, isMobile = false }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [openMenu, setOpenMenu] = useState(null);

  /* ================= MENU STRUCTURE ================= */

  const menuItems = useMemo(
    () => [
      { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
      { icon: "assignment_ind", label: "Delegation", path: "/delegation" },
      { icon: "check_box", label: "Checklist", path: "/checklist" },
      { icon: "checklist", label: "TODO", path: "/todo" },
      {
        icon: "score",
        label: "Scoring",
        children: [
          { icon: "assignment_ind", label: "Delegation", path: "/score" },
          {
            icon: "analytics",
            label: "Combined MIS Score",
            path: "/combined-mis",
          },
        ],
      },
      {
        icon: "folder_open",
        label: "FMS",
        children: [
          { icon: "orders", label: "O2D FMS", path: "/o2d-fms" },
          // { icon: 'orders', label: 'O2D', path: '/o2d' },
          { icon: "support_agent", label: "Help Ticket", path: "/help" },
        ],
      },

      { icon: "inventory_2", label: "IMS", path: "/ims" },
      { icon: "person", label: "Profile", path: "/profile" },
    ],
    [],
  );

  /* ================= AUTO OPEN PARENT IF CHILD ACTIVE ================= */

  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.children) {
        const childMatch = item.children.find(
          (child) => child.path === location.pathname,
        );
        if (childMatch) {
          setOpenMenu(item.label);
        }
      }
    });
  }, [location.pathname, menuItems]);

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  /* ================= RENDER ================= */

  return (
    <aside
      className={`${isCollapsed ? "w-20" : "w-72"}
      flex-col border-r border-border-main bg-bg-card transition-all duration-300
      ${isMobile ? "flex w-full border-r-0" : "hidden md:flex"}
      shrink-0 h-full overflow-hidden`}
    >
      {/* ===== Branding ===== */}
      {!isMobile && (
        <div className="p-4 border-b border-border-main flex items-center justify-between">
          <div
            className={`flex items-center gap-3 transition-opacity duration-300
            ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`}
          >
            <div className="size-10 flex items-center justify-center shadow-sm overflow-hidden">
              <img
                src="/d-tab-logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>

            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-base font-bold text-text-main leading-tight">
                  D-Tab
                </h1>
                <p className="text-text-muted text-xs">v2.4</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-bg-main text-text-muted"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCollapsed ? "menu_open" : "menu"}
            </span>
          </button>
        </div>
      )}

      {/* ===== Navigation ===== */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {!isCollapsed && (
          <p className="px-3 pt-2 pb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
            Modules
          </p>
        )}

        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isParentOpen = openMenu === item.label;

          /* ===== Parent Menu ===== */
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setOpenMenu(isParentOpen ? null : item.label)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-text-muted hover:bg-bg-main transition-all"
                >
                  <span className="material-symbols-outlined text-slate-500">
                    {item.icon}
                  </span>

                  {!isCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">
                        {item.label}
                      </span>
                      <span className="material-symbols-outlined text-[18px]">
                        {isParentOpen ? "expand_less" : "expand_more"}
                      </span>
                    </>
                  )}
                </button>

                {/* Child Items */}
                {isParentOpen && !isCollapsed && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.path;

                      return (
                        <button
                          key={child.path}
                          onClick={() => navigate(child.path)}
                          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition
                            ${
                              isChildActive
                                ? "bg-primary/10 text-primary"
                                : "text-text-muted hover:bg-bg-main"
                            }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {child.icon}
                          </span>
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          /* ===== Normal Menu Item ===== */
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all
                ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-bg-main"
                }`}
            >
              <span className="material-symbols-outlined text-slate-500">
                {item.icon}
              </span>

              {!isCollapsed && (
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ===== Footer ===== */}
      <div className="p-4 border-t border-border-main">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-red-50 text-text-muted transition-colors"
        >
          <div className="bg-bg-main rounded-full size-10 flex items-center justify-center font-bold text-text-main border-2 border-primary/20">
            {user?.name?.charAt(0) || "U"}
          </div>

          {!isCollapsed && (
            <>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-bold truncate">
                  {user?.name || "User"}
                </span>
                <span className="text-xs text-text-muted truncate capitalize">
                  {user?.role || "Staff"}
                </span>
              </div>

              <span className="material-symbols-outlined text-text-muted">
                logout
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
