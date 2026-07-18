import { Suspense, lazy, useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Menu from "./Menu";
import Melodica from "./Melodica/Melodica";
import { PlaybackToolbarProvider } from "./PlaybackToolbarProvider";
import { RouteErrorBoundary } from "./ErrorBoundary";
import { usePersistentState } from "./hooks/usePersistentState";
import { UserScoreLibraryProvider } from "./MusicXML/UserScoreLibraryContext";

const Circle = lazy(() => import("./Circle/Circle"));
const Help = lazy(() => import("./Help/Help"));
const MusicXML = lazy(() => import("./MusicXML/MusicXML"));
const Practice = lazy(() => import("./Practice/Practice"));
const Settings = lazy(() => import("./Settings/Settings"));

function App() {
  const [isMenuPinned, setIsMenuPinned] = usePersistentState<boolean>("melodicatrainer_menu_pinned", true, {
    sanitize: (v) => (typeof v === "boolean" ? v : undefined),
  });
  const [isMenuHovered, setIsMenuHovered] = useState(false);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ pinned: boolean }>;
      setIsMenuPinned(customEvent.detail.pinned);
    };
    window.addEventListener("toggle-all-panels", handleToggle);
    return () => window.removeEventListener("toggle-all-panels", handleToggle);
  }, [setIsMenuPinned]);

  return (
    <Router>
      <UserScoreLibraryProvider>
        <PlaybackToolbarProvider>
        <div className="grid h-screen w-full max-w-full grid-rows-[auto_1fr] bg-gray-950 overflow-hidden relative">
          {/* Invisible Trigger for the Global Menu Drawer */}
          <div 
            className="absolute left-0 right-0 top-0 h-4 z-[60] hidden lg:block cursor-ns-resize"
            onMouseEnter={() => setIsMenuHovered(true)}
          />

          <div 
            className={`w-full shrink-0 transition-all duration-300 ease-in-out grid relative z-50
              ${isMenuHovered || isMenuPinned ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
            `}
            onMouseLeave={() => setIsMenuHovered(false)}
          >
            <div className="overflow-hidden w-full max-w-full">
              <Menu isPinned={isMenuPinned} onTogglePin={() => setIsMenuPinned(!isMenuPinned)} />
            </div>
          </div>

          <main className="min-h-0 w-full overflow-hidden relative">
            <RouteErrorBoundary>
              <Suspense
                fallback={
                  <div className="min-h-full bg-gray-950 p-6 text-white">
                    Loading...
                  </div>
                }
              >
                <Routes>
                  <Route path="/circle" element={<Circle />} />
                  <Route path="/melodica" element={<Melodica />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/musicxml" element={<MusicXML />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/harmonica" element={<Navigate to="/melodica" replace />} />
                  <Route path="/" element={<Navigate to="/musicxml" replace />} />
                </Routes>
              </Suspense>
            </RouteErrorBoundary>
          </main>
        </div>
        </PlaybackToolbarProvider>
      </UserScoreLibraryProvider>
    </Router>
  );
}

export default App;
