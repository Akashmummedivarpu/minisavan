import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Edit2, Camera } from 'lucide-react';
import { useRoomStore } from '../store';
import AuthModal from './AuthModal';
import { authenticatedFetch } from '../api';

export default function UserProfileDropdown() {
  const { user, token, setAuth, logout } = useRoomStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Edit State
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditUsername(user?.username || '');
    setEditAvatar(user?.avatar || '');
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAvatarClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) return;
    setIsSaving(true);
    try {
      const data = await authenticatedFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          username: editUsername,
          avatar: editAvatar
        })
      });
      setAuth(data, token);
      setShowEditModal(false);
      setShowDropdown(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleAvatarClick}
        className="flex items-center justify-center w-10 h-10 rounded-full border border-glassBorder bg-glass overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all"
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <User size={20} className="text-secondary" />
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && user && (
        <div className="absolute top-12 right-0 w-48 bg-glassPanel backdrop-blur-xl border border-glassBorder rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-white/5">
            <p className="font-bold text-sm truncate">{user.username}</p>
            <p className="text-xs text-secondary truncate">{user.phoneNumber}</p>
          </div>
          <div className="p-2">
            <button 
              onClick={() => {
                setShowEditModal(true);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-colors text-left"
            >
              <Edit2 size={16} /> Edit Profile
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors text-left"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal for Logged out users */}
      {showAuthModal && (
        <AuthModal isOpen={true} onClose={() => setShowAuthModal(false)} />
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-glassPanel border border-glassBorder p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Edit Profile</h2>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-glassBorder bg-glass flex items-center justify-center overflow-hidden relative group">
                  {editAvatar ? (
                     <img src={editAvatar} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                     <User size={40} className="text-secondary" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Username</label>
                <input 
                  type="text" 
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Avatar URL (Optional)</label>
                <input 
                  type="url" 
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-white text-black px-4 py-3 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
