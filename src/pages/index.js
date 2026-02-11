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
            className={`group relative w-full h-full min-h-[110px] md:min-h-[130px] cursor-pointer rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`absolute inset-0 border-2 ${theme.border} opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl ${theme.shadow} shadow-lg`}></div>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-40`}></div>
            <div className="relative z-10 flex flex-col items-center justify-center p-3 text-center">
                <div className={`p-2 rounded-xl bg-black/40 border border-white/10 mb-2 shadow-md`}>
                    <Icon size={24} className={`${theme.icon} drop-shadow-md`} />
                </div>
                <h3 className="text-xs md:text-sm font-black italic uppercase text-white leading-tight mb-1">
                    {title}
                </h3>
                <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-wider ${theme.text} opacity-80`}>{subtitle}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] text-white font-sans selection:bg-cyan-500 selection:text-black relative overflow-x-hidden flex flex-col">
      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-black -z-20"></div>

      {/* BANNER 2 BÊN (Chỉ hiện desktop) */}
      {homeConfig.leftBanner && (<div className="fixed top-0 left-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.leftBanner} className="w-full h-full object-cover opacity-80"/></div>)}
      {homeConfig.rightBanner && (<div className="fixed top-0 right-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.rightBanner} className="w-full h-full object-cover opacity-80"/></div>)}

      {/* 1. HEADER */}
      <header className="h-16 md:h-[70px] shrink-0 z-[100] bg-black/20 backdrop-blur-md border-b border-white/5 relative">
          <div className="relative z-20 container mx-auto h-full px-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  {homeConfig.logoTitleImage ? (
                      <img src={homeConfig.logoTitleImage} alt="Logo" className="h-8 md:h-12 object-contain drop-shadow-lg"/>
                  ) : (
                      <div className="flex items-center gap-2" onClick={() => router.push('/')}>
                        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-1.5 rounded-lg shadow-lg"><Gamepad2 className="text-white" size={18} /></div>
                        <h1 className="text-base md:text-xl font-black italic tracking-tighter uppercase">EDU <span className="text-cyan-400">ARENA</span></h1>
                      </div>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {user ? (
                  <div className="flex items-center gap-2 bg-black/40 pl-1 pr-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                      <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-7 h-7 rounded-full border border-cyan-500" />
                      <button onClick={() => router.push('/dashboard')} className="p-1.5 bg-indigo-600 rounded-lg text-white"><Settings size={14}/></button>
                      <button onClick={() => signOut(auth)} className="p-1.5 bg-red-600/80 rounded-lg text-white"><LogOut size={14}/></button>
                  </div>
                ) : (
                  <button onClick={handleLogin} className="flex items-center gap-2 bg-cyan-600 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider">
                      <LogIn size={16}/> GV Đăng nhập
                  </button>
                )}
              </div>
          </div>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col p-3 md:p-6 gap-4 overflow-y-auto">
          
          {/* LUYỆN TẬP */}
          <div className="shrink-0 w-full bg-black/60 backdrop-blur-xl border-2 border-red-600/30 rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-xl">
                <div className="bg-gradient-to-br from-red-700 to-orange-800 p-3 md:w-48 flex items-center justify-center gap-2 shrink-0 md:flex-col md:border-r border-red-500/30">
                    <Target size={24} className="text-yellow-300 animate-pulse"/>
                    <h2 className="text-sm md:text-lg font-black uppercase text-white tracking-tighter">Luyện Tập</h2>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar flex">
                    {/* Hàng số lớp - Tối ưu click trên Mobile */}
                    <div className="flex w-full min-w-max">
                        {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
                            <button 
                                key={grade}
                                onClick={() => handleGradeClick(grade)}
                                className="px-5 py-4 md:flex-1 border-l border-red-900/30 hover:bg-red-600/20 transition-colors flex flex-col items-center justify-center min-w-[65px]"
                            >
                                <span className="text-2xl md:text-4xl font-black italic text-yellow-100">{grade}</span>
                                <span className="text-[8px] font-bold uppercase text-red-300">Lớp</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* GRID CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <CyberCard title="Chiến Binh Arena" subtitle="Đấu trường sinh tử" icon={Sword} color="purple" delay={0} onClick={() => openGamePortal('CLASSIC')}/>
                <CyberCard title="Biệt Đội Arena" subtitle="Hợp sức tác chiến" icon={Shield} color="orange" delay={100} onClick={() => openGamePortal('RACE')}/>
                <CyberCard title="Nhanh Như Chớp" subtitle="Tốc độ sấm sét" icon={Zap} color="cyan" delay={200} onClick={() => openGamePortal('LIGHTNING')}/>
                <CyberCard title="Arena Thi Online" subtitle="Khảo thí online" icon={BookOpen} color="green" delay={300} onClick={() => router.push('/exam')}/>
                <CyberCard title="Bảng Tương Tác" subtitle="Kết nối real-time" icon={Users} color="blue" delay={400} onClick={() => router.push('/connect')}/>
                <CyberCard title="Cổng Nộp Bài" subtitle="Cho học sinh" icon={UploadCloud} color="pink" delay={500} onClick={() => router.push('/submit')}/>
            </div>

            {/* NAVIGATION BOTTOM - Chuẩn mobile */}
            <div className="w-full bg-black/60 backdrop-blur-xl border-t-2 border-cyan-600/30 rounded-2xl overflow-hidden shadow-lg mt-auto">
                <div className="grid grid-cols-4 md:grid-cols-8 w-full h-16 md:h-20">
                    {/* Nút Vòng Xoay */}
                    <button onClick={() => router.push('/bottom/SpinWheel')} className="flex flex-col items-center justify-center bg-cyan-900/20 border-r border-cyan-900/30">
                        <Disc size={20} className="text-cyan-300 mb-1 animate-spin-slow"/>
                        <span className="text-[8px] md:text-[9px] font-black uppercase text-cyan-100 text-center leading-tight">Vòng xoay<br/>gọi tên</span>
                    </button>
                    {/* Nút Vote */}
                    <button onClick={() => router.push('/bottom/VoteArena')} className="flex flex-col items-center justify-center bg-cyan-900/20 border-r border-cyan-900/30">
                        <BarChart2 size={20} className="text-cyan-300 mb-1"/>
                        <span className="text-[8px] md:text-[9px] font-black uppercase text-cyan-100 text-center leading-tight">Vote<br/>lấy ý kiến</span>
                    </button>
                    {/* Các nút trống - Co lại trên mobile */}
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="hidden md:flex flex-col items-center justify-center border-r border-cyan-900/30 opacity-30">
                            <div className="w-1 h-1 rounded-full bg-slate-500 mb-1"></div>
                            <span className="text-[7px] uppercase text-slate-500">Sắp ra mắt</span>
                        </div>
                    ))}
                    {/* Hiển thị 2 ô trống cho đủ hàng Grid trên Mobile */}
                    <div className="md:hidden flex items-center justify-center border-r border-cyan-900/30 opacity-20"><div className="w-1 h-1 rounded-full bg-slate-500"></div></div>
                    <div className="md:hidden flex items-center justify-center opacity-20"><div className="w-1 h-1 rounded-full bg-slate-500"></div></div>
                </div>
            </div>
      </main>

      {/* FOOTER INFO */}
      <footer className="h-8 shrink-0 bg-[#0a0a0a]/90 backdrop-blur border-t border-white/5 flex items-center justify-between px-4">
            <div className="flex items-center gap-1">
                <Eye size={10} className="text-purple-500"/>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                    Visits: <span className="text-white">{realVisitorCount.toLocaleString()}</span>
                </p>
            </div>
            <p className="text-slate-600 text-[7px] font-bold uppercase tracking-[0.2em]">
                © 2026 Edu Arena Connect
            </p>
      </footer>

      {/* MODAL PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-cyan-500/30 p-6 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setShowPinModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={24}/></button>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">
                  {targetGame === 'CLASSIC' ? 'Chiến Binh' : targetGame === 'RACE' ? 'Biệt Đội' : 'Nhanh Như Chớp'}
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase">Nhập mã PIN</p>
            </div>
            <form onSubmit={handleJoinGame} className="space-y-4">
              <input autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-[#050505] border-2 border-slate-700 text-center text-4xl font-black text-white py-4 rounded-2xl focus:border-cyan-500 outline-none" placeholder="000000" maxLength={6}/>
              <button type="submit" className="w-full py-4 rounded-2xl font-black text-lg uppercase italic bg-white text-black hover:bg-cyan-400 transition-all flex items-center justify-center gap-2">
                  Vào Ngay <ArrowRight size={20} strokeWidth={3}/>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}