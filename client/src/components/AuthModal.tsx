import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { useRoomStore } from '../store';

const AVATARS = [
  '/avatars/avatar_1_1787246244560.jpg',
  '/avatars/avatar_2_1787246259580.jpg',
  '/avatars/avatar_3_1787246306763.jpg',
  '/avatars/avatar_4_1787246322879.jpg',
  '/avatars/avatar_5_1787246532417.jpg',
  '/avatars/avatar_6_1787246376491.jpg',
  '/avatars/avatar_7_1787246393407.jpg',
  '/avatars/avatar_8_1787246409497.jpg'
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useRoomStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin ? { phoneNumber } : { phoneNumber, username, avatar: selectedAvatar };
      
      const response = await fetch(`http://localhost:3001/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setAuth(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] border border-glassBorder p-8 rounded-[24px] w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-300">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold mb-2 tracking-tight">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-secondary text-sm mb-6">
          {isLogin ? 'Log in to host rooms and sync with friends.' : 'Sign up to create your own listening rooms.'}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white/80">Choose Avatar</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {AVATARS.map((avatar, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`relative cursor-pointer rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                        selectedAvatar === avatar ? 'border-accent scale-105' : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <img src={avatar} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                      {selectedAvatar === avatar && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Check size={20} className="text-accent" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white/80">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-white/5 border border-glassBorder rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
                  placeholder="SonicDJ"
                  required={!isLogin}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80">Phone Number</label>
            <input 
              type="tel" 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="bg-white/5 border border-glassBorder rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="+1234567890"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 bg-white text-black font-bold py-3.5 rounded-xl hover:bg-white/90 transition-colors flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Log In' : 'Register')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-secondary">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-white font-bold hover:underline"
          >
            {isLogin ? 'Register' : 'Log In'}
          </button>
        </div>

      </div>
    </div>
  );
}
