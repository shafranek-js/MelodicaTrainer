import { Suspense, lazy, useState } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Menu from "./Menu";
import Harmonica from "./Harmonica/Harmonica";

const Circle = lazy(() => import("./Circle/Circle"));
const MusicXML = lazy(() => import("./MusicXML/MusicXML"));
const Practice = lazy(() => import("./Practice/Practice"));

function App() {
  const [tabsState, setTabsState] = useState<any>(null);

  return (
    <Router>
      <div className="grid h-screen w-full max-w-full grid-rows-[auto_1fr] bg-gray-950 overflow-hidden">
        <Menu 
          isPlaying={tabsState?.isPlaying}
          onTogglePlayback={tabsState?.onTogglePlayback}
          onRestartPlayback={tabsState?.onRestartPlayback}
          tempo={tabsState?.tempo}
          setTempo={tabsState?.setTempo}
          progress={tabsState?.progress}
          gameStats={tabsState?.gameStats}
          accuracy={tabsState?.accuracy}
          canPlayback={tabsState?.canPlayback}
        />
        <main className="min-h-0 w-full overflow-hidden">
          <Suspense
            fallback={
              <div className="min-h-full bg-gray-950 p-6 text-white">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route path="/circle" element={<Circle />} />
              <Route path="/harmonica" element={<Harmonica />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/musicxml" element={<MusicXML setGlobalState={setTabsState} />} />
              <Route path="/" element={<Navigate to="/harmonica" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
