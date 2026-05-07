import { Suspense, lazy } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Menu from "./Menu";
import Circle from "./Circle/Circle";
import Harmonica from "./Harmonica/Harmonica";
import Practice from "./Practice/Practice";
import Settings from "./Settings/Settings";

const MusicXML = lazy(() => import("./MusicXML/MusicXML"));

function App() {
  return (
    <Router>
      <div className="flex flex-col h-screen">
        <div>
          <Menu />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="min-h-screen bg-gray-950 p-6 text-white">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route path="/circle" element={<Circle />} />
              <Route path="/harmonica" element={<Harmonica />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/musicxml" element={<MusicXML />} />
              <Route path="/" element={<Navigate to="/harmonica" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </Router>
  );
}

export default App;
