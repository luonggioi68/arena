import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, firestore } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, onSnapshot, setDoc } from 'firebase/firestore'; 
import useAuthStore from '@/store/useAuthStore';
import { 
    LogIn, LogOut, Sword, Shield, BookOpen, Users, X, ArrowRight, 
    Gamepad2, Settings, UploadCloud, Zap, Eye, Target, Disc, BarChart2 
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetGame, setTargetGame] = useState(null); 
  const [pin, setPin] = useState('');
  
  const [homeConfig, setHomeConfig] = useState({ topBanner: '', leftBanner: '', rightBanner: '', logoTitleImage: '' });
  const [realVisitorCount, setRealVisitorCount] = useState(0); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, [setUser]);

  useEffect(() => {
      const fetchHomeConfig = async () => {
          try {
              const docSnap = await getDoc(doc(firestore, "system_config", "homepage"));
              if (docSnap.exists()) setHomeConfig(docSnap.data());
          } catch (e) { console.error("Lỗi tải giao diện:", e); }
      };
      fetchHomeConfig();
  }, []);

  useEffect(() => {
      const statsRef = doc(firestore, "system_stats", "visitor_counter");
      const incrementVisit = async () => {
          try {
              const docSnap = await getDoc(statsRef);
              if (!docSnap.exists()) await setDoc(statsRef, { count: 1 });
              else if (!sessionStorage.getItem('visited')) {
                  await updateDoc(statsRef, { count: increment(1) });
                  sessionStorage.setItem('visited', 'true');
              }
          } catch (e) {}
      };
      incrementVisit();
      return onSnapshot(statsRef, (doc) => { if (doc.exists()) setRealVisitorCount(doc.data().count || 0); });
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) { alert("Đăng nhập thất bại!"); }
  };

  const openGamePortal = (type) => {
    setTargetGame(type);
    setShowPinModal(true);
    setPin('');
  };

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    if (targetGame === 'CLASSIC') router.push(`/play/${pin}`);
    else if (targetGame === 'RACE') router.push(`/play/race?pin=${pin}`);
    else if (targetGame === 'LIGHTNING') router.push(`/play/lightning?pin=${pin}`); 
  };

  const handleGradeClick = (grade) => {
      router.push(`/training?grade=${grade}`);
  };

  const CyberCard = ({ title, subtitle, icon: Icon, color, onClick, delay }) => {
      const colorMap = {
          purple: { border: 'border-purple-500', shadow: 'shadow-purple-500/40', text: 'text-purple-400', bg: 'from-purple-900/40 to-slate-900', icon: 'text-purple-300' },
          orange: { border: 'border-orange-500', shadow: 'shadow-orange-500/40', text: 'text-orange-400', bg: 'from-orange-900/40 to-slate-900', icon: 'text-orange-300' },
          cyan:   { border: 'border-cyan-500',   shadow: 'shadow-cyan-500/40',   text: 'text-cyan-400',   bg: 'from-cyan-900/40 to-slate-900',   icon: 'text-cyan-300' },
          green:  { border: 'border-emerald-500', shadow: 'shadow-emerald-500/40', text: 'text-emerald-400', bg: 'from-emerald-900/40 to-slate-900', icon: 'text-emerald-300' },
          blue:   { border: 'border-blue-500',    shadow: 'shadow-blue-500/40',    text: 'text-blue-400',    bg: 'from-blue-900/40 to-slate-900',    icon: 'text-blue-300' },
          pink:   { border: 'border-pink-500',    shadow: 'shadow-pink-500/40',    text: 'text-pink-400',    bg: 'from-pink-900/40 to-slate-900',    icon: 'text-pink-300' },
      };
      const theme = colorMap[color];

      return (
        <div 
            onClick={onClick} 
            className={`group relative w-full h-full min-h-[110px] md:min-h-[140px] cursor-pointer rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300 active:scale-95 flex flex-col items-center justify-center p-3`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`absolute inset-0 border-2 ${theme.border} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${theme.shadow} shadow-lg`}></div>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-40 group-hover:opacity-60 transition-opacity`}></div>

            <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <div className={`p-2 rounded-xl bg-black/40 border border-white/10 mb-2 shadow-md`}>
                    <Icon size={24} className={`${theme.icon} drop-shadow-md`} strokeWidth={1.5} />
                </div>
                <h3 className="text-xs md:text-base font-black italic uppercase text-white tracking-tighter leading-tight mb-1 drop-shadow-lg line-clamp-1">
                    {title}
                </h3>
                <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest ${theme.text} opacity-80`}>{subtitle}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#020617] text-white font-sans selection:bg-cyan-500 selection:text-black relative flex flex-col overflow-x-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-black -z-20"></div>
      
      {/* 1. HEADER */}
      <header className="h-[60px] md:h-[70px] shrink-0 z-[100] bg-black/40 backdrop-blur-md border-b border-white/5 shadow-xl relative">
          <div className="container mx-auto h-full px-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                  {homeConfig.logoTitleImage ? (
                      <img src={homeConfig.logoTitleImage} alt="Logo" className="h-8 md:h-12 object-contain"/>
                  ) : (
                      <div className="flex items-center gap-2">
                        <div className="bg-cyan-600 p-1.5 rounded-lg"><Gamepad2 size={18} /></div>
                        <h1 className="text-sm md:text-xl font-black italic text-white uppercase">ARENA <span className="text-cyan-400">EDU</span></h1>
                      </div>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {user ? (
                  <div className="flex items-center gap-2 bg-black/40 p-1 rounded-full border border-white/10">
                      <img src={user.photoURL} className="w-7 h-7 rounded-full border border-cyan-500" />
                      <button onClick={() => router.push('/dashboard')} className="p-1.5 bg-indigo-600 rounded-lg"><Settings size={14}/></button>
                      <button onClick={() => signOut(auth)} className="p-1.5 bg-red-600/80 rounded-lg"><LogOut size={14}/></button>
                  </div>
                ) : (
                  <button onClick={handleLogin} className="p-2 bg-cyan-600 rounded-xl"><LogIn size={18}/></button>
                )}
              </div>
          </div>
      </header>

      {/* 2. BODY CONTENT */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col px-3 md:px-6 pt-3 pb-2 gap-3 overflow-y-auto custom-scrollbar">
          
          {/* A. NAV 1: LUYỆN TẬP */}
          <div className="shrink-0 w-full bg-black/80 border-2 border-red-600/50 rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl h-[75px] md:h-[90px]">
                <div className="bg-gradient-to-br from-red-700 to-orange-800 px-3 flex flex-row md:flex-col items-center justify-center gap-2 md:w-40 shrink-0 border-b md:border-b-0 md:border-r border-red-500/30">
                    <Target size={20} className="text-yellow-300"/>
                    <h2 className="text-xs md:text-lg font-black uppercase text-white">Luyện Tập</h2>
                </div>

                <div className="flex-1 flex overflow-x-auto [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-full min-w-max h-full">
                        {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
                            <button 
                                key={grade}
                                onClick={() => handleGradeClick(grade)}
                                className="group relative flex-1 min-w-[55px] md:min-w-0 flex flex-col items-center justify-center transition-all border-l border-red-900/30 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-red-900/50"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <span className="text-2xl md:text-4xl font-black italic text-yellow-300 group-hover:scale-110 transition-transform">
                                        {grade}
                                    </span>
                                    <span className="text-[7px] md:text-[9px] font-bold uppercase text-red-200">Lớp</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* B. GRID 6 MỤC CHÍNH */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 flex-1">
                <CyberCard title="Chiến Binh Arena" subtitle="Đấu trường" icon={Sword} color="purple" delay={0} onClick={() => openGamePortal('CLASSIC')}/>
                <CyberCard title="Biệt Đội Arena" subtitle="Hợp sức" icon={Shield} color="orange" delay={100} onClick={() => openGamePortal('RACE')}/>
                <CyberCard title="Nhanh Như Chớp" subtitle="Tốc độ" icon={Zap} color="cyan" delay={200} onClick={() => openGamePortal('LIGHTNING')}/>
                <CyberCard title="Arena Thi Online" subtitle="Khảo thí" icon={BookOpen} color="green" delay={300} onClick={() => router.push('/exam')}/>
                <CyberCard title="Bảng Tương Tác" subtitle="Thời gian thực" icon={Users} color="blue" delay={400} onClick={() => router.push('/connect')}/>
                <CyberCard title="Cổng Nộp Bài" subtitle="Học sinh" icon={UploadCloud} color="pink" delay={500} onClick={() => router.push('/submit')}/>
            </div>

            {/* C. FOOTER BAR: TỐI ƯU CUỘN NGANG CHO MOBILE */}
            <div className="shrink-0 w-full bg-black/80 border-t-2 border-cyan-600/50 rounded-2xl overflow-hidden h-[75px] md:h-[85px]">
                <div className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden h-full bg-slate-900/50">
                    {[
                        { label: 'Vòng Xoay\nGọi Tên', icon: Disc, path: '/bottom/SpinWheel' },
                        { label: 'Vote\nLấy ý kiến', icon: BarChart2, path: '/bottom/VoteArena' },
                        { label: 'Sắp ra mắt', icon: null },
                        { label: 'Sắp ra mắt', icon: null },
                        { label: 'Sắp ra mắt', icon: null },
                        { label: 'Sắp ra mắt', icon: null },
                        { label: 'Sắp ra mắt', icon: null },
                        { label: 'Sắp ra mắt', icon: null },
                    ].map((item, index) => (
                        <button 
                            key={index}
                            onClick={() => item.path && router.push(item.path)}
                            className={`flex-shrink-0 w-[25%] md:w-[12.5%] h-full flex flex-col items-center justify-center border-r border-cyan-900/20 snap-start
                                ${item.path ? 'bg-cyan-900/10 active:bg-cyan-800/30' : 'opacity-40'}
                            `}
                        >
                            {item.icon ? (
                                <>
                                    <item.icon size={22} className="text-cyan-400 mb-1"/>
                                    <span className="text-[8px] font-black uppercase text-cyan-100 text-center leading-tight whitespace-pre-line">
                                        {item.label}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-slate-500 mb-1"></div>
                                    <span className="text-[7px] font-bold uppercase text-slate-500">Soon</span>
                                </>
                            )}
                        </button>
                    ))}
                </div>
            </div>
      </div>

      {/* 3. FOOTER INFO */}
      <footer className="h-[25px] shrink-0 bg-black flex items-center justify-between px-4 text-[7px] font-bold text-slate-500 uppercase">
          <div className="flex items-center gap-2">
                <Eye size={10} className="text-purple-500"/>
                <span>Visits: {realVisitorCount}</span>
          </div>
          <span>© 2026 Edu Arena</span>
      </footer>

      {/* MODAL PIN - TỐI ƯU MOBILE */}
      {showPinModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0f172a] border-t border-cyan-500/30 p-6 rounded-t-[2rem] md:rounded-[3rem] w-full max-w-md animate-in slide-in-from-bottom">
            <button onClick={() => setShowPinModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={24}/></button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-white uppercase italic">Nhập mã PIN</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{targetGame}</p>
            </div>
            <form onSubmit={handleJoinGame} className="space-y-4">
              <input autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-black border-2 border-slate-700 text-center text-4xl font-black text-white py-4 rounded-2xl focus:border-cyan-500 outline-none font-mono tracking-widest" placeholder="000000" maxLength={6}/>
              <button type="submit" className="w-full py-4 rounded-2xl font-black text-lg bg-white text-black uppercase italic active:scale-95">Tham Chiến</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}