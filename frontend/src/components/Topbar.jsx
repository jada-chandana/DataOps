
export default function Topbar({ title, description, onMenuClick }) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button
          className="menu-button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <div className="workspace-status">
        <span className="status-dot" />
        <span>Local Workspace</span>
      </div>
    </header>
  );
}
