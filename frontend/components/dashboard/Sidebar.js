import PropTypes from "prop-types";
import { useRouter } from "next/navigation";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  modules,
} from "../../constants/analysis";

export default function Sidebar({
  isOpen,
  setIsOpen,
  mode,
  setMode,
  activeTab,
  setActiveTab,
}) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login");
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:block
      `}
      >
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter text-blue-600 uppercase hover:opacity-80 transition-opacity cursor-default">
            AutoEDA
          </h1>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            x
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="hidden lg:block space-y-2">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-2">
              Workspace
            </div>
            <button
              type="button"
              onClick={() => setMode("current")}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
                mode === "current"
                  ? "bg-blue-50 text-blue-700"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              Current Analysis
            </button>
            <button
              type="button"
              onClick={() => setMode("history")}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
                mode === "history"
                  ? "bg-blue-50 text-blue-700"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              History
            </button>
          </div>

          <div className="lg:hidden space-y-1">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-2">
              Analysis Modules
            </div>
            {modules.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => {
                  setActiveTab(m.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-[0.98] ${
                  activeTab === m.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <span className="mr-3">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all group"
          >
            <span
              className="mr-3 text-lg group-hover:scale-110 transition-transform"
              aria-hidden="true"
            >
              ⏻
            </span>
            Sign Out
          </button>

          <div className="mt-4 px-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              👤
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-zinc-800 truncate uppercase tracking-tighter">
                Active Session
              </p>
              <p className="text-[9px] text-zinc-400 truncate">AutoEDA v1.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func.isRequired,
  mode: PropTypes.string.isRequired,
  setMode: PropTypes.func.isRequired,
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
};
