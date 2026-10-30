
const navigation = [
  { id: "overview", icon: "▦", label: "Overview" },
  { id: "profiling", icon: "◫", label: "Data Profiling" },
   { id: "cleaning", icon: "🧹", label: "Data Cleaning" },
  { id: "validation", icon: "✓", label: "Data Validation" },
  { id: "reconciliation", icon: "⇄", label: "Reconciliation" },
{ id: "drift", icon: "📊", label: "Data Drift Detection" },
  { id: "reports", icon: "▤", label: "Reports" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

export default function Sidebar({ activePage, onNavigate, open }) {
  return (
    <>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close sidebar"
          onClick={() => onNavigate(activePage)}
        />
      )}

      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">D</div>
          <div>
            <h2>DataOps One</h2>
            <span>DATA QUALITY PLATFORM</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-icon">i</div>
          <strong>Data quality matters</strong>
          <p>Find issues before they reach production.</p>
        </div>
      </aside>
    </>
  );
}
