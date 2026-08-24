import React from 'react';
import { Home as HomeIcon, Search as SearchIcon, Radio, Library as LibraryIcon } from 'lucide-react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Search from './pages/Search';
import Rooms from './pages/Rooms';
import RoomDashboard from './pages/RoomDashboard';
import Library from './pages/Library';
import PlaylistView from './pages/PlaylistView';
import Player from './components/Player';

function App() {
  const location = useLocation();

  // Dynamic ambient background image based on current route or playing song
  // For now, static beautiful backgrounds for each route
  const getAmbientBg = () => {
    if (location.pathname === '/search') return "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80')";
    return "url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=1200&q=80')";
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative">
      {/* Floating Glass Dock (Mobile Bottom / Tablet Vertical Pill / Desktop Full Sidebar) */}
      <nav className="fixed md:top-0 md:bottom-auto bottom-8 left-0 w-full md:w-20 lg:w-60 md:h-screen flex justify-center md:items-center lg:items-start lg:bg-black/40 lg:backdrop-blur-[40px] lg:border-r lg:border-glassBorder z-50 pointer-events-none md:pointer-events-auto">
        <div className="pointer-events-auto flex md:flex-col items-center lg:items-start justify-between md:justify-center w-[calc(100%-48px)] md:w-[60px] lg:w-full max-w-[342px] md:max-w-none md:h-auto lg:h-full glass-dock lg:bg-transparent lg:border-none lg:shadow-none lg:rounded-none rounded-full md:rounded-[100px] px-6 py-3 md:py-8 lg:p-10 gap-0 md:gap-8 lg:gap-4">
          <NavItem to="/" icon={<HomeIcon size={22} />} label="Home" />
          <NavItem to="/search" icon={<SearchIcon size={22} />} label="Search" />
          <NavItem to="/rooms" icon={<Radio size={22} />} label="Rooms" />
          <NavItem to="/library" icon={<LibraryIcon size={22} />} label="Library" />
        </div>
      </nav>

      {/* Ambient Blurred Background */}
      <div 
        className="absolute top-0 left-0 w-full h-[60vh] min-h-[500px] bg-cover bg-center ambient-mask filter blur-[40px] saturate-150 scale-110 z-0 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: getAmbientBg() }}
      ></div>

      <div className="relative z-10 w-full max-w-[500px] md:max-w-[900px] lg:max-w-[1200px] mx-auto pt-[50px] pb-[120px] md:py-[60px] md:ml-20 lg:ml-60">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:roomId" element={<RoomDashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:playlistId" element={<PlaylistView />} />
          {/* Add more routes here later */}
          <Route path="*" element={<Home />} />
        </Routes>
      </div>

      <Player />
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex lg:flex-row flex-col items-center lg:justify-start gap-1 lg:gap-4 lg:w-full lg:px-4 lg:py-3 lg:rounded-xl transition-all ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)] hover:text-white hover:bg-white/5'}`
      }
    >
      {icon}
      <span className="hidden lg:block text-[15px] font-medium">{label}</span>
    </NavLink>
  );
}

export default App;
