import React, { useState } from 'react';
import { Cloud, X } from 'lucide-react';
import { cloudSignIn } from '../utils/cloud';

interface CloudLoginModalProps {
  onClose: () => void;
}

// Simple email+password sign-in for the owner's Supabase account.
const CloudLoginModal: React.FC<CloudLoginModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await cloudSignIn(email.trim(), password);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    onClose(); // session change is picked up by the auth listener in App
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2"><Cloud size={20} className="text-indigo-600" /> Вход в облако</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-neutral-500">После входа база будет автоматически синхронизироваться между вашими устройствами.</p>
          <input required type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" />
          <input required type="password" placeholder="Пароль" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" />
          {error && <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 text-sm font-bold">{error}</div>}
          <button type="submit" disabled={busy} className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-60 transition-all">
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CloudLoginModal;
