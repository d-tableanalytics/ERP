import React from "react";
import MainLayout from "../components/layout/MainLayout";
import StatCard from "../components/dashboard/StatCard";

const getModuleConfig = (type) => {
  switch (type) {
    case "attendance":
      return {
        title: "Attendance Management",
        stats: [
          {
            title: "Present Today",
            value: "1,145",
            icon: "how_to_reg",
            trend: "92%",
            trendLabel: "Daily Average",
            color: "green",
          },
          {
            title: "Absent",
            value: "45",
            icon: "person_off",
            trend: "+2%",
            trendLabel: "vs Yesterday",
            color: "red",
          },
          {
            title: "Late Arrivals",
            value: "23",
            icon: "timer_off",
            trend: "-5%",
            trendLabel: "Improving",
            color: "orange",
          },
          {
            title: "On Leave",
            value: "37",
            icon: "flight_takeoff",
            trend: "Normal",
            trendLabel: "Planned",
            color: "blue",
          },
        ],
        tableHeaders: [
          "Employee",
          "Department",
          "Check In",
          "Check Out",
          "Status",
        ],
        tableData: [
          {
            col1: "John Doe",
            col2: "Engineering",
            col3: "09:00 AM",
            col4: "06:00 PM",
            col5: "Present",
            statusColor: "text-green-600 bg-green-100",
          },
          {
            col1: "Jane Smith",
            col2: "HR",
            col3: "09:15 AM",
            col4: "06:15 PM",
            col5: "Late",
            statusColor: "text-orange-600 bg-orange-100",
          },
          {
            col1: "Robert Key",
            col2: "Finance",
            col3: "-",
            col4: "-",
            col5: "Absent",
            statusColor: "text-red-600 bg-red-100",
          },
          {
            col1: "Emily Davis",
            col2: "Marketing",
            col3: "08:50 AM",
            col4: "05:50 PM",
            col5: "Present",
            statusColor: "text-green-600 bg-green-100",
          },
        ],
      };
    case "salary":
      return {
        title: "Payroll & Salary",
        stats: [
          {
            title: "Total Payroll",
            value: "$1.2M",
            icon: "payments",
            trend: "+1.5%",
            trendLabel: "vs Last Month",
            color: "blue",
          },
          {
            title: "Pending Process",
            value: "12",
            icon: "pending",
            trend: "Urgent",
            trendLabel: "Action Required",
            color: "orange",
          },
          {
            title: "Avg Salary",
            value: "$45k",
            icon: "currency_exchange",
            trend: "Stable",
            trendLabel: "Yearly",
            color: "purple",
          },
          {
            title: "Bonuses Paid",
            value: "$125k",
            icon: "celebration",
            trend: "+12%",
            trendLabel: "Q4 Performance",
            color: "green",
          },
        ],
        tableHeaders: ["Employee", "Role", "Base Salary", "Bonus", "Status"],
        tableData: [
          {
            col1: "Michael Brown",
            col2: "Senior Dev",
            col3: "$95,000",
            col4: "$5,000",
            col5: "Processed",
            statusColor: "text-emerald-600 bg-emerald-100",
          },
          {
            col1: "Sarah Wilson",
            col2: "Designer",
            col3: "$72,000",
            col4: "$2,000",
            col5: "Pending",
            statusColor: "text-amber-600 bg-amber-100",
          },
          {
            col1: "David Lee",
            col2: "Manager",
            col3: "$110,000",
            col4: "$15,000",
            col5: "Processed",
            statusColor: "text-emerald-600 bg-emerald-100",
          },
          {
            col1: "Lisa Ray",
            col2: "QA Lead",
            col3: "$88,000",
            col4: "$4,000",
            col5: "Processing",
            statusColor: "text-blue-600 bg-blue-100",
          },
        ],
      };
    case "fms":
      return {
        title: "File Management System",
        stats: [
          {
            title: "Total Files",
            value: "45.2k",
            icon: "folder_open",
            trend: "+120",
            trendLabel: "New this week",
            color: "blue",
          },
          {
            title: "Storage Used",
            value: "1.2TB",
            icon: "cloud_queue",
            trend: "82%",
            trendLabel: "Capacity",
            color: "purple",
          },
          {
            title: "Recent Uploads",
            value: "145",
            icon: "upload_file",
            trend: "Active",
            trendLabel: "Today",
            color: "green",
          },
          {
            title: "Shared Files",
            value: "3,200",
            icon: "share",
            trend: "Stable",
            trendLabel: "Internal",
            color: "orange",
          },
        ],
        tableHeaders: ["File Name", "Owner", "Size", "Last Modified", "Type"],
        tableData: [
          {
            col1: "Project_Specs.pdf",
            col2: "Alice Green",
            col3: "2.4 MB",
            col4: "2 hours ago",
            col5: "PDF",
            statusColor: "text-red-500 bg-red-50",
          },
          {
            col1: "Budget_2025.xlsx",
            col2: "Finance Team",
            col3: "450 KB",
            col4: "Yesterday",
            col5: "Excel",
            statusColor: "text-green-600 bg-green-50",
          },
          {
            col1: "Logo_Assets.zip",
            col2: "Design Team",
            col3: "150 MB",
            col4: "Jan 15, 2025",
            col5: "Archive",
            statusColor: "text-purple-600 bg-purple-50",
          },
          {
            col1: "Meeting_Notes.docx",
            col2: "John Doe",
            col3: "25 KB",
            col4: "Jan 12, 2025",
            col5: "Word",
            statusColor: "text-blue-600 bg-blue-50",
          },
        ],
      };
    case "todo":
      return {
        title: "Task Management (TODO)",
        stats: [
          {
            title: "My Tasks",
            value: "18",
            icon: "assignment",
            trend: "4 Due",
            trendLabel: "Today",
            color: "blue",
          },
          {
            title: "Completed",
            value: "145",
            icon: "task_alt",
            trend: "+12",
            trendLabel: "This Week",
            color: "green",
          },
          {
            title: "Overdue",
            value: "3",
            icon: "warning",
            trend: "Action",
            trendLabel: "High Priority",
            color: "red",
          },
          {
            title: "Team Tasks",
            value: "62",
            icon: "group_work",
            trend: "Active",
            trendLabel: "Ongoing",
            color: "purple",
          },
        ],
        tableHeaders: ["Task", "Project", "Due Date", "Priority", "Status"],
        tableData: [
          {
            col1: "Update Homepage UI",
            col2: "Website Revamp",
            col3: "Today",
            col4: "High",
            col5: "In Progress",
            statusColor: "text-blue-600 bg-blue-100",
          },
          {
            col1: "Fix Login Bug",
            col2: "App Maintenance",
            col3: "Tomorrow",
            col4: "Critical",
            col5: "Pending",
            statusColor: "text-red-600 bg-red-100",
          },
          {
            col1: "Draft Q1 Report",
            col2: "Quarterly Review",
            col3: "Jan 25",
            col4: "Medium",
            col5: "Not Started",
            statusColor: "text-slate-600 bg-slate-100",
          },
          {
            col1: "Team Sync",
            col2: "Operations",
            col3: "Jan 26",
            col4: "Low",
            col5: "Done",
            statusColor: "text-emerald-600 bg-emerald-100",
          },
        ],
      };
    case "ims":
      return {
        title: "Inventory Management",
        stats: [
          {
            title: "Total Stock",
            value: "8,450",
            icon: "inventory_2",
            trend: "Good",
            trendLabel: "Stock Level",
            color: "blue",
          },
          {
            title: "Low Stock",
            value: "12",
            icon: "production_quantity_limits",
            trend: "Ordered",
            trendLabel: "Replenishing",
            color: "orange",
          },
          {
            title: "Incoming",
            value: "500",
            icon: "local_shipping",
            trend: "Tomorrow",
            trendLabel: "Expected",
            color: "purple",
          },
          {
            title: "Damaged",
            value: "0.5%",
            icon: "broken_image",
            trend: "Low",
            trendLabel: "Quality Control",
            color: "green",
          },
        ],
        tableHeaders: ["Item Name", "Category", "SKU", "Stock Qty", "Status"],
        tableData: [
          {
            col1: "Office Chair V2",
            col2: "Furniture",
            col3: "FUR-001",
            col4: "145",
            col5: "In Stock",
            statusColor: "text-emerald-600 bg-emerald-100",
          },
          {
            col1: 'Dell Monitor 24"',
            col2: "Electronics",
            col3: "ELE-552",
            col4: "12",
            col5: "Low Stock",
            statusColor: "text-amber-600 bg-amber-100",
          },
          {
            col1: "Wireless Mouse",
            col2: "Electronics",
            col3: "ELE-883",
            col4: "350",
            col5: "In Stock",
            statusColor: "text-emerald-600 bg-emerald-100",
          },
          {
            col1: "USB-C Cable",
            col2: "Accessories",
            col3: "ACC-102",
            col4: "0",
            col5: "Out of Stock",
            statusColor: "text-red-600 bg-red-100",
          },
        ],
      };
    case "hrms":
      return {
        title: "HR Management System",
        stats: [
          {
            title: "Total Staff",
            value: "1,250",
            icon: "badge",
            trend: "+5",
            trendLabel: "New Hires",
            color: "blue",
          },
          {
            title: "Open Positions",
            value: "8",
            icon: "person_search",
            trend: "Hiring",
            trendLabel: "Active",
            color: "purple",
          },
          {
            title: "Reviews Due",
            value: "24",
            icon: "rate_review",
            trend: "Q1",
            trendLabel: "Performance",
            color: "orange",
          },
          {
            title: "Satisfaction",
            value: "4.8",
            icon: "sentiment_satisfied",
            trend: "High",
            trendLabel: "eNPS Score",
            color: "green",
          },
        ],
        tableHeaders: [
          "Candidate / Employee",
          "Position",
          "Department",
          "Date",
          "Status",
        ],
        tableData: [
          {
            col1: "Alex Johnson",
            col2: "Senior Dev",
            col3: "Engineering",
            col4: "Joined Today",
            col5: "Onboarding",
            statusColor: "text-blue-600 bg-blue-100",
          },
          {
            col1: "Maria Garcia",
            col2: "Sales Lead",
            col3: "Sales",
            col4: "Interviewing",
            col5: "Round 2",
            statusColor: "text-purple-600 bg-purple-100",
          },
          {
            col1: "Sam Wilson",
            col2: "Product Manager",
            col3: "Product",
            col4: "Offered",
            col5: "Pending",
            statusColor: "text-amber-600 bg-amber-100",
          },
          {
            col1: "Chris Evans",
            col2: "Designer",
            col3: "Design",
            col4: "Rejected",
            col5: "Closed",
            statusColor: "text-slate-600 bg-slate-100",
          },
        ],
      };
    default:
      return {
        title: "Module",
        stats: [],
        tableHeaders: [],
        tableData: [],
      };
  }
};

const DemoModule = ({ type }) => {
  const config = getModuleConfig(type);
  const [activeSetting, setActiveSetting] = React.useState("General");
  // Profile Layout
  if (type === "profile") {
    return (
      <MainLayout title="User Profile">
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
          {/* Header Card */}
          <div className="bg-bg-card border border-border-main rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <div className="relative">
              <div className="size-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold border-4 border-bg-card shadow-lg">
                SJ
              </div>
              <span className="absolute bottom-1 right-1 size-5 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="text-center md:text-left flex-1">
              <h2 className="text-2xl font-bold text-text-main">
                Sanchit Jain
              </h2>
              <p className="text-text-muted font-medium">
                Senior Administrator
              </p>
              <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                  IT Department
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                  New York
                </span>
              </div>
            </div>
            <button className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors">
              Edit Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Info Column */}
            <div className="space-y-6">
              <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-text-main mb-4">Contact Info</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-muted">
                      mail
                    </span>
                    <span className="text-text-main">sanchit@d-table.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-muted">
                      call
                    </span>
                    <span className="text-text-main">+1 (555) 123-4567</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-muted">
                      location_on
                    </span>
                    <span className="text-text-main">123 Tech Park, NY</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Column */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-text-main mb-4">
                  Recent Activity
                </h3>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-4 items-start pb-4 border-b border-border-main last:border-0 last:pb-0"
                    >
                      <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-sm text-text-muted">
                          history
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-main">
                          Updated system configurations
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Changed default theme settings for the engineering
                          team.
                        </p>
                        <span className="text-[10px] text-text-muted mt-2 block">
                          2 hours ago
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Settings Layout
  if (type === "settings") {
    const SETTINGS = [
      "General",
      "Security",
      "Notifications",
      "Team",
      "Billing",
      "Integrations",
      "Help Ticket Setting",
    ];

    return (
      <MainLayout title="Application Settings">
        <div className="max-w-4xl mx-auto bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 min-h-[600px]">
            {/* ---------------- Sidebar ---------------- */}
            <div className="bg-bg-main/50 border-r border-border-main p-4 space-y-1">
              {SETTINGS.map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveSetting(item)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-colors
                    ${
                      activeSetting === item
                        ? "bg-primary/10 text-primary"
                        : "text-text-muted hover:bg-bg-main hover:text-text-main"
                    }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* ---------------- Content ---------------- */}   
            <div className="md:col-span-3 p-8 space-y-8">
              {/* ===== General Settings ===== */}
              {activeSetting === "General" && (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-text-main mb-1">
                      General Settings
                    </h3>
                    <p className="text-text-muted text-sm pb-4 border-b border-border-main">
                      Manage your workspace preferences.
                    </p>
                  </div>

                  <div className="space-y-6 max-w-md">
                    <div className="grid gap-2">
                      <label className="text-sm font-bold text-text-main">
                        Workspace Name
                      </label>
                      <input
                        type="text"
                        defaultValue="D-Table Analytics"
                        className="px-4 py-2 bg-bg-main border border-border-main rounded-lg outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-bold text-text-main">
                        Language
                      </label>
                      <select className="px-4 py-2 bg-bg-main border border-border-main rounded-lg outline-none focus:border-primary">
                        <option>English (US)</option>
                        <option>Spanish</option>
                        <option>French</option>
                      </select>
                    </div>

                    {/* Dark Mode */}
                    <div className="flex items-center justify-between pt-4 border-t border-border-main">
                      <div>
                        <h4 className="text-sm font-bold text-text-main">
                          Dark Mode
                        </h4>
                        <p className="text-xs text-text-muted">
                          Toggle system wide dark theme
                        </p>
                      </div>
                      <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                        <div className="absolute top-1 right-1 size-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ===== Help Ticket Settings ===== */}
              {activeSetting === "Help Ticket Setting" && (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-text-main mb-1">
                      Help Ticket Settings
                    </h3>
                    <p className="text-text-muted text-sm pb-4 border-b border-border-main">
                      Configure automation rules for help tickets.
                    </p>
                  </div>

                  <div className="space-y-6 max-w-lg">
                    <div className="grid gap-2">
                      <label className="text-sm font-bold text-text-main">
                        Auto Close Ticket After (Days)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 7"
                        className="px-4 py-2 bg-bg-main border border-border-main rounded-lg outline-none focus:border-primary"
                      />
                      <p className="text-xs text-text-muted">
                        Ticket will close automatically if inactive.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-bold text-text-main">
                        Reminder Before Due Date (Days)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 1"
                        className="px-4 py-2 bg-bg-main border border-border-main rounded-lg outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-bold text-text-main">
                        Default Internal Remark
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Internal note added to every ticket"
                        className="px-4 py-2 bg-bg-main border border-border-main rounded-lg outline-none resize-none focus:border-primary"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ===== Coming Soon Placeholder ===== */}
              {!["General", "Help Ticket Setting"].includes(activeSetting) && (
                <div className="flex items-center justify-center h-[300px] text-text-muted text-sm font-bold">
                  {activeSetting} settings coming soon 🚧
                </div>
              )}

              {/* ===== Save / Cancel ===== */}
              {["General", "Help Ticket Setting"].includes(activeSetting) && (
                <div className="pt-6 border-t border-border-main flex justify-end gap-3">
                  <button className="px-4 py-2 text-text-muted text-sm font-bold hover:text-text-main">
                    Cancel
                  </button>
                  <button className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90">
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Notifications Layout
  if (type === "notifications") {
    return (
      <MainLayout title="Notifications">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-full">
                All
              </button>
              <button className="px-4 py-1.5 bg-bg-card border border-border-main text-text-muted text-xs font-bold rounded-full hover:bg-bg-main">
                Unread
              </button>
              <button className="px-4 py-1.5 bg-bg-card border border-border-main text-text-muted text-xs font-bold rounded-full hover:bg-bg-main">
                Mentioned
              </button>
            </div>
            <button className="text-primary text-xs font-bold hover:underline">
              Mark all as read
            </button>
          </div>

          <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm">
            {[
              {
                title: "New leave request",
                desc: "John Doe requested sick leave for tomorrow.",
                time: "10 mins ago",
                icon: "event_busy",
                color: "bg-orange-100 text-orange-600",
              },
              {
                title: "Project Milestone",
                desc: "Design phase completed for Client X.",
                time: "2 hours ago",
                icon: "flag",
                color: "bg-green-100 text-green-600",
              },
              {
                title: "System Update",
                desc: "Server maintenance scheduled for Sunday.",
                time: "5 hours ago",
                icon: "dns",
                color: "bg-blue-100 text-blue-600",
              },
              {
                title: "New Comment",
                desc: "Sarah replied to your task in Marketing.",
                time: "1 day ago",
                icon: "chat",
                color: "bg-purple-100 text-purple-600",
              },
            ].map((n, i) => (
              <div
                key={i}
                className="flex gap-4 p-4 border-b border-border-main last:border-0 hover:bg-bg-main/50 transition-colors cursor-pointer group"
              >
                <div
                  className={`size-10 rounded-full flex items-center justify-center shrink-0 ${n.color}`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {n.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-text-muted">
                      {n.time}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-0.5">{n.desc}</p>
                </div>
                <div className="size-2 rounded-full bg-primary mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Internal Help Layout
  if (type === "help") {
    return (
      <MainLayout title="Internal Help Desk">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Search Hero */}
          <div className="bg-gradient-to-r from-blue-600 to-primary rounded-2xl p-10 text-center text-white shadow-lg">
            <h2 className="text-3xl font-bold mb-2">
              How can we help you, Sanchit?
            </h2>
            <p className="text-blue-100 mb-6">
              Search our knowledge base or contact IT support.
            </p>
            <div className="bg-white rounded-xl p-2 max-w-xl mx-auto flex items-center shadow-md">
              <span className="material-symbols-outlined text-slate-400 ml-2">
                search
              </span>
              <input
                type="text"
                placeholder="Search for guides, errors, or policies..."
                className="flex-1 p-2 text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary/90">
                Search
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Guides */}
            <div className="bg-bg-card border border-border-main rounded-2xl p-6 hover:border-primary transition-colors cursor-pointer group h-full">
              <div className="size-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-2xl">
                  menu_book
                </span>
              </div>
              <h3 className="font-bold text-text-main mb-2">User Guides</h3>
              <p className="text-sm text-text-muted">
                Step-by-step tutorials for using all ERP modules efficiently.
              </p>
            </div>
            {/* IT Support */}
            <div className="bg-bg-card border border-border-main rounded-2xl p-6 hover:border-primary transition-colors cursor-pointer group h-full">
              <div className="size-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-2xl">
                  support_agent
                </span>
              </div>
              <h3 className="font-bold text-text-main mb-2">Contact IT</h3>
              <p className="text-sm text-text-muted">
                Raise a ticket for hardware issues, software bugs, or access
                requests.
              </p>
            </div>
            {/* Policies */}
            <div className="bg-bg-card border border-border-main rounded-2xl p-6 hover:border-primary transition-colors cursor-pointer group h-full">
              <div className="size-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-2xl">
                  policy
                </span>
              </div>
              <h3 className="font-bold text-text-main mb-2">Company Policy</h3>
              <p className="text-sm text-text-muted">
                Review HR guidelines, leave policies, and security protocols.
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-bg-card border border-border-main rounded-2xl p-6">
            <h3 className="font-bold text-text-main mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                quiz
              </span>
              Frequently Asked Questions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "How do I reset my password?",
                "How to apply for leave?",
                "Where to find payslips?",
                "How to update profile info?",
              ].map((q, i) => (
                <div
                  key={i}
                  className="p-4 bg-bg-main rounded-xl flex justify-between items-center cursor-pointer hover:bg-border-main/50 transition-colors"
                >
                  <span className="text-sm font-bold text-text-muted">{q}</span>
                  <span className="material-symbols-outlined text-text-muted text-sm">
                    arrow_forward_ios
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={config.title}>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-bg-card p-4 rounded-xl border border-border-main shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-text-main">Overview</h2>
            <p className="text-text-muted text-sm">
              Key performance indicators and recent activities.
            </p>
          </div>
          <button className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>
            Export Report
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {config.stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart/Table Area */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Dummy Chart Placeholder */}
            <div className="bg-bg-card p-6 rounded-2xl border border-border-main shadow-sm flex flex-col h-[300px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-text-main">Trends Analysis</h3>
                <select className="bg-bg-main border border-border-main text-text-muted text-xs rounded-lg px-2 py-1 outline-none">
                  <option>Last 30 Days</option>
                  <option>This Year</option>
                </select>
              </div>
              <div className="flex-1 flex items-end justify-between gap-4 px-2">
                {/* Simulated Bar Chart */}
                {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 95].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="w-full bg-primary/10 hover:bg-primary/20 rounded-t-lg transition-all relative group"
                      style={{ height: `${h}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-text-main text-bg-main text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Value: {h}
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-text-muted font-bold uppercase tracking-wider">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>

            {/* Recent Items Table */}
            <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border-main flex justify-between items-center">
                <h3 className="font-bold text-text-main">Recent Records</h3>
                <button className="text-primary text-xs font-bold hover:underline">
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-main/50 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                      {config.tableHeaders.map((header, i) => (
                        <th key={i} className="p-4 border-b border-border-main">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main text-sm">
                    {config.tableData.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-bg-main/30 transition-colors"
                      >
                        <td className="p-4 font-bold text-text-main">
                          {row.col1}
                        </td>
                        <td className="p-4 text-text-muted">{row.col2}</td>
                        <td className="p-4 text-text-muted font-medium">
                          {row.col3}
                        </td>
                        <td className="p-4 text-text-muted">{row.col4}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.statusColor}`}
                          >
                            {row.col5}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Side Widgets */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="mb-4 bg-white/20 w-fit p-2 rounded-lg backdrop-blur-sm">
                <span className="material-symbols-outlined text-2xl">
                  auto_awesome
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2">Pro Insights</h3>
              <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                Your metrics are trending upwards! Consider reviewing the
                quarterly goals to maintain this momentum.
              </p>
              <button className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:scale-105 transition-transform w-full">
                View Analysis
              </button>
            </div>

            {/* Quick Links Dummy */}
            <div className="bg-bg-card rounded-2xl border border-border-main p-5 shadow-sm">
              <h3 className="font-bold text-text-main mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <button
                    key={item}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-bg-main hover:bg-border-main transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-sm">
                          arrow_forward
                        </span>
                      </div>
                      <span className="text-sm font-bold text-text-muted group-hover:text-text-main transition-colors">
                        Action Item {item}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-text-muted text-sm -rotate-45 group-hover:rotate-0 transition-transform">
                      arrow_forward
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DemoModule;
