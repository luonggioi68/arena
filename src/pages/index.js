import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, firestore } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, onSnapshot, setDoc } from 'firebase/firestore'; 
import useAuthStore from '@/store/useAuthStore';
import { LogIn, LogOut, Sword, Shield, BookOpen, Users, X, ArrowRight, Gamepad2, Settings, UploadCloud, Zap, Activity, Globe, Eye } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetGame, setTargetGame] = useState(null); 
  const [pin, setPin] = useState('');
  
  const [homeConfig, setHomeConfig] = useState({ topBanner: '', leftBanner: '', rightBanner: '', logoTitleImage: '' });
  
  // State Thống kê
  const [realVisitorCount, setRealVisitorCount] = useState(0); 
  const [onlineUsers, setOnlineUsers] = useState(1); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, [setUser]);

  // --- 1. LẤY CẤU HÌNH GIAO DIỆN ---
  useEffect(() => {
      const fetchHomeConfig = async () => {
          try {
              const docSnap = await getDoc(doc(firestore, "system_config", "homepage"));
              if (docSnap.exists()) {
                  setHomeConfig(docSnap.data());
              }
          } catch (e) { console.error("Lỗi tải giao diện:", e); }
      };
      fetchHomeConfig();
  }, []);

  // --- 2. THỐNG KÊ ---
  useEffect(() => {
      const statsRef = doc(firestore, "system_stats", "visitor_counter");
      const incrementVisit = async () => {
          try {
              const docSnap = await getDoc(statsRef);
              if (!docSnap.exists()) {
                  await setDoc(statsRef, { count: 1 });
              } else {
                  if (!sessionStorage.getItem('visited')) {
                      await updateDoc(statsRef, { count: increment(1) });
                      sessionStorage.setItem('visited', 'true');
                  }
              }
          } catch (e) { console.error("Lỗi thống kê:", e); }
      };
      incrementVisit();
      const unsubscribe = onSnapshot(statsRef, (doc) => {
          if (doc.exists()) setRealVisitorCount(doc.data().count || 0);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
      const interval = setInterval(() => {
          setOnlineUsers(prev => {
              const change = Math.floor(Math.random() * 3) - 1;
              return Math.max(1, prev + change); 
          });
      }, 4000);
      return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
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

  // COMPONENT CARD GAME
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
            className={`group relative h-[160px] 2xl:h-[200px] cursor-pointer rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-8`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`absolute inset-0 border-2 ${theme.border} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${theme.shadow} shadow-lg`}></div>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-40 group-hover:opacity-60 transition-opacity`}></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>

            <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center">
                <div className={`p-2.5 rounded-xl bg-black/40 border border-white/10 mb-2 group-hover:scale-110 transition-transform duration-300 ${theme.shadow} shadow-md`}>
                    <Icon size={28} className={`${theme.icon} drop-shadow-md`} strokeWidth={1.5} />
                </div>
                <h3 className="text-base 2xl:text-lg font-black italic uppercase text-white tracking-tighter leading-none mb-1 drop-shadow-lg group-hover:tracking-normal transition-all">
                    {title}
                </h3>
                <p className={`text-[8px] font-bold uppercase tracking-[0.2em] ${theme.text} opacity-80 group-hover:opacity-100`}>{subtitle}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden flex flex-col">
      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-black -z-20"></div>
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 -z-10 pointer-events-none"></div>

      {/* BANNER 2 BÊN */}
      {homeConfig.leftBanner && (<div className="fixed top-0 left-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.leftBanner} className="w-full h-full object-cover opacity-80 mask-image-right"/></div>)}
      {homeConfig.rightBanner && (<div className="fixed top-0 right-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.rightBanner} className="w-full h-full object-cover opacity-80 mask-image-left"/></div>)}

      {/* 1. HEADER */}
      <header className="h-[90px] shrink-0 z-[100] transition-all duration-300 bg-black/10 backdrop-blur-sm border-b border-white/5 shadow-[0_5px_30px_rgba(0,0,0,0.5)] relative">
          {homeConfig.topBanner && (
              <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-10"></div>
                  <img src={homeConfig.topBanner} className="w-full h-full object-cover object-center opacity-100"/>
              </div>
          )}
          
          <div className="relative z-20 container mx-auto h-full px-4 md:px-6 flex justify-between items-center">
              {/* LOGO (ĐÃ FIX: Hiện cả trên Mobile) */}
              <div className="flex items-center gap-4">
                  {homeConfig.logoTitleImage ? (
                      <img src={homeConfig.logoTitleImage} alt="Logo" className="h-12 md:h-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform"/>
                  ) : (
                      <div className="flex items-center gap-2 md:gap-3 group cursor-pointer">
                        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-2 md:p-2.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/10 group-hover:rotate-12 transition-transform duration-500"><Gamepad2 className="text-white" size={24} /></div>
                        {/* [FIX] Bỏ class 'hidden md:block' để hiển thị text trên mobile */}
                        <div className="leading-none">
                            <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">EDU <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">ARENA</span></h1>
                            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.4em] drop-shadow-sm">Connect</p>
                        </div>
                      </div>
                  )}
              </div>

              {/* USER / LOGIN [FIX: ANIMATION THỤT VÀO ĐẨY RA] */}
              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-4 bg-black/40 pl-2 pr-6 py-1.5 rounded-full border border-white/10 backdrop-blur-md hover:bg-black/60 transition-all group shadow-lg">
                      <div className="relative">
                          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-cyan-500 shadow-[0_0_10px_#22d3ee]" />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></div>
                      </div>
                      <div className="hidden md:block">
                          <div className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider">Commander</div>
                          <div className="text-xs font-bold text-white leading-none max-w-[120px] truncate">{user.displayName}</div>
                      </div>
                      <div className="h-6 w-px bg-white/20 mx-1"></div>
                      <div className="flex gap-2">
                          <button onClick={() => router.push('/dashboard')} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition shadow-lg" title="Trung tâm điều khiển"><Settings size={16}/></button>
                          <button onClick={() => signOut(auth)} className="p-1.5 bg-red-600/80 hover:bg-red-500 rounded-lg text-white transition shadow-lg" title="Đăng xuất"><LogOut size={16}/></button>
                      </div>
                  </div>
                ) : (
                  // NÚT LOGIN [FIX]: Thụt vào (chỉ hiện icon), hover/click đẩy ra chữ
                  <button onClick={handleLogin} className="group relative h-10 w-10 hover:w-44 transition-all duration-500 ease-in-out bg-cyan-600/90 text-white rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-500 overflow-hidden flex items-center border border-cyan-400/30">
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
                      
                      {/* Icon luôn hiện ở bên trái */}
                      <div className="absolute left-0 w-10 h-10 flex items-center justify-center z-10 shrink-0">
                          <LogIn size={20} className="drop-shadow-md"/>
                      </div>
                      
                      {/* Text chỉ hiện khi hover/active */}
                      <span className="pl-10 pr-4 font-black text-xs uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                          GV Đăng nhập
                      </span>
                  </button>
                )}
              </div>
          </div>
      </header>

      {/* 2. BODY CONTENT ([FIX] CHO PHÉP CUỘN TRÊN MOBILE: overflow-y-auto) */}
      <div className="flex-1 relative w-full 2xl:max-w-[70%] mx-auto flex flex-col px-4 md:px-8 overflow-y-auto custom-scrollbar z-10 py-6 md:justify-center">
          <main className="w-full">
            
            <div className="mb-6 2xl:mb-10 text-center mt-4 md:mt-0">
                <h2 className="text-lg md:text-2xl font-black text-slate-400 uppercase tracking-[0.3em] mb-2 opacity-80 animate-pulse text-shadow-glow">Choose Your Battle</h2>
                <div className="h-0.5 w-20 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto"></div>
            </div>

            {/* GRID 6 MỤC - Có thêm padding-bottom để không bị che bởi footer khi cuộn */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 w-full pb-10">
              <CyberCard title="Chiến Binh Arena" subtitle="Đấu trường sinh tử" icon={Sword} color="purple" delay={0} onClick={() => openGamePortal('CLASSIC')}/>
              <CyberCard title="Biệt Đội Arena" subtitle="Hợp sức tác chiến" icon={Shield} color="orange" delay={100} onClick={() => openGamePortal('RACE')}/>
              <CyberCard title="Nhanh Như Chớp" subtitle="Tốc độ sấm sét" icon={Zap} color="cyan" delay={200} onClick={() => openGamePortal('LIGHTNING')}/>
              <CyberCard title="Arena Thi Online" subtitle="Khảo thí thi online" icon={BookOpen} color="green" delay={300} onClick={() => router.push('/exam')}/>
              <CyberCard title="Bảng Tương Tác" subtitle="Kết nối thời gian thực" icon={Users} color="blue" delay={400} onClick={() => router.push('/connect')}/>
              <CyberCard title="Cổng Nộp Bài" subtitle="Dành cho học sinh" icon={UploadCloud} color="pink" delay={500} onClick={() => router.push('/submit')}/>
            </div>
          </main>
      </div>

      {/* 3. FOOTER [FIX: BỎ CLASS HIDDEN TRÊN MOBILE] */}
      <footer className="h-[40px] shrink-0 bg-[#0a0a0a]/90 backdrop-blur border-t border-white/5 relative z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 group cursor-help" title="Số người đang online (Mô phỏng)">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               
            </div>
            <div className="h-3 w-px bg-white/10"></div>
            <div className="flex items-center gap-2 group cursor-help" title="Tổng lượt truy cập thực tế">
                <Eye size={12} className="text-purple-500"/>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-purple-400 transition-colors">
                    Visits: <span className="text-white font-mono">{realVisitorCount.toLocaleString()}</span>
                </p>
            </div>
        </div>
        
        {/* [FIX] Hiện Copyright trên cả Mobile (bỏ hidden md:block) */}
        <p className="absolute left-1/2 -translate-x-1/2 text-slate-600 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.3em] hover:text-cyan-600 transition-colors cursor-default whitespace-nowrap">
            © 2026 Lương Văn Giỏi - 0383477162
        </p>
        
     
      </footer>

      {/* MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-cyan-500/30 p-8 rounded-[3rem] w-full max-w-md shadow-[0_0_100px_rgba(6,182,212,0.2)] relative animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
            <button onClick={() => setShowPinModal(false)} className="absolute top-5 right-5 bg-white/5 p-2 rounded-full hover:bg-red-500 hover:text-white transition text-slate-400"><X size={20}/></button>
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white/5 animate-bounce-slow">
                  {targetGame === 'CLASSIC' && <Sword size={48} className="text-purple-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />}
                  {targetGame === 'RACE' && <Shield size={48} className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />}
                  {targetGame === 'LIGHTNING' && <Zap size={48} className="text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />}
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
                  {targetGame === 'CLASSIC' ? 'Chiến Binh' : targetGame === 'RACE' ? 'Biệt Đội' : 'Nhanh Như Chớp'}
              </h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nhập mã PIN để tham chiến</p>
            </div>
            <form onSubmit={handleJoinGame} className="space-y-6">
              <input autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-[#050505] border-2 border-slate-700 text-center text-5xl font-black text-white py-5 rounded-2xl focus:border-cyan-500 focus:shadow-[0_0_30px_rgba(6,182,212,0.3)] outline-none transition-all font-mono tracking-[0.2em] placeholder:text-slate-800 placeholder:tracking-normal" placeholder="000000" maxLength={6}/>
              <button type="submit" className={`w-full py-5 rounded-2xl font-black text-xl uppercase italic shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 bg-white text-black hover:bg-cyan-400 hover:shadow-[0_0_20px_#22d3ee]`}>
                  Vào Ngay <ArrowRight size={24} strokeWidth={3}/>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}