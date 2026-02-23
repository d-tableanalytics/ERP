const FMSTabs = ({ tabs, activeTab, onChange }) => {
  const activeTabData = tabs.find((tab) => tab.key === activeTab);

  return (
    <div className="bg-bg-card mt-6 border border-border-main rounded-xl">

      {/* ===== Tabs Row ===== */}
      <div className="px-4 border-b border-border-main">
        <div
          className="
            flex gap-6
            overflow-x-auto
            whitespace-nowrap
            scroll-smooth
            scrollbar-hide
          "
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`relative py-4 text-sm font-semibold transition flex-shrink-0
                ${
                  activeTab === tab.key
                    ? "text-primary"
                    : "text-text-muted hover:text-text-main"
                }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}

                {tab.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </span>

              {activeTab === tab.key && (
                <span className="absolute left-0 bottom-0 w-full h-[2px] bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Active Header Section ===== */}
      {activeTabData?.header && (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-primary text-lg">✔</span>
          <h2 className="text-lg font-semibold text-primary uppercase tracking-wide">
            {activeTabData.header}
          </h2>
        </div>
      )}
    </div>
  );
};

export default FMSTabs;