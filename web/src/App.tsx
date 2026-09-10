import { NavLink, Route, Routes } from 'react-router-dom';
import Leaderboard from './pages/Leaderboard';
import Matches from './pages/Matches';
import Event from './pages/Event';
import Admin from './pages/Admin';

export default function App() {
  return (
    <>
      <nav className="nav">
        <span className="brand">⚔️ デュエルアリーナ</span>
        <NavLink to="/" end>
          ランキング
        </NavLink>
        <NavLink to="/matches">試合履歴</NavLink>
        <NavLink to="/event">イベント</NavLink>
        <span className="spacer" />
        <NavLink to="/admin">管理</NavLink>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/event" element={<Event />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </>
  );
}
