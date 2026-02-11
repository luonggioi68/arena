// src/lib/gameConfig.js
import { DollarSign, CircleDashed, LayoutGrid, Grid3X3, FileText, Gift, Map, Gamepad2 } from 'lucide-react';

// CHÚ Ý TỪ KHÓA "export" Ở ĐẦU DÒNG DƯỚI ĐÂY
export const GAME_MODES = [
  {
    id: 'EXAM',
    title: 'Arena Thi Online',
    subtitle: 'Mô phỏng thi thật',
    desc: 'Trí tuệ & Kịch tính',
    gradient: 'from-[#D31027] to-[#EA384D]',
    shadow: 'shadow-red-900/40',
    icon: FileText,
    badge: 'HOT',
    type: 'EXAM'
  },
  {
    id: 'MILLIONAIRE',
    title: 'Triệu Phú',
    subtitle: 'Trí tuệ & Kịch tính',
    gradient: 'from-[#1e3c72] to-[#2a5298]',
    shadow: 'shadow-blue-900/40',
    icon: DollarSign,
    badge: 'HOT',
    type: 'GAME'
  },
  {
    id: 'WHEEL',
    title: 'Vòng Quay',
    subtitle: 'Ngẫu nhiên & May mắn',
    gradient: 'from-[#ec008c] to-[#fc6767]',
    shadow: 'shadow-pink-900/40',
    icon: CircleDashed,
    type: 'GAME'
  },
  {
    id: 'JOURNEY',
    title: 'Hành trình vượt ải',
    subtitle: 'Phiêu lưu & Chinh phục',
    gradient: 'from-[#614385] to-[#516395]',
    shadow: 'shadow-indigo-900/40',
    icon: Map,
    badge: 'NEW',
    btnText: 'CHƠI NGAY',
    type: 'GAME'
  },
  {
    id: 'BOX',
    title: 'Hộp Bí Mật',
    subtitle: 'Hồi hộp & Bất ngờ',
    gradient: 'from-[#8E2DE2] to-[#4A00E0]',
    shadow: 'shadow-purple-900/40',
    icon: Gift,
    type: 'GAME'
  }
  
  
   
];