import React from 'react';
import { HomeIcon, ChartIcon, ChatIcon, UserIcon } from './Icons';

interface BottomNavProps {
  active?: string;
  onChange?: (id: string) => void;
}

const items = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'marks', label: 'Marks', Icon: ChartIcon },
  { id: 'messages', label: 'Messages', Icon: ChatIcon },
  { id: 'profile', label: 'Profile', Icon: UserIcon },
];

export const BottomNav: React.FC<BottomNavProps> = ({ active = 'home', onChange }) => {
  return (
    <nav className="fixed left-4 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] h-16 rounded-full bg-[#7A1A2C] shadow-[0_10px_25px_rgba(122,26,44,0.35)] flex items-center justify-around z-40 border border-[#96263B]">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          onClick={() => onChange?.(id)}
          className={`w-12 h-12 rounded-full flex items-center justify-center min-h-[44px] min-w-[44px] transition-all cursor-pointer ${
            active === id
              ? 'bg-[#F6C84C] text-[#4A101E] shadow-sm font-bold'
              : 'text-[#FCE7EC] hover:text-white'
          }`}
        >
          <Icon />
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
