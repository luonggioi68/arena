import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
    signInWithPopup, signOut, onAuthStateChanged, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    sendPasswordResetEmail, updateProfile 
} from 'firebase/auth';
import { auth, googleProvider, firestore } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, onSnapshot, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore'; 
import useAuthStore from '@/store/useAuthStore';
import { 
    LogIn, LogOut, Sword, Shield, BookOpen, Users, X, ArrowRight, 
    Gamepad2, Settings, UploadCloud, Zap, Eye, Target, Disc, BarChart2,
    Mail, Lock, User, Phone, CheckCircle, AlertCircle
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  // State cho Game Pin
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetGame, setTargetGame] = useState(null); 
  const [pin, setPin] = useState('');
  
  // State cho Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('LOGIN'); 
  const [authData, setAuthData] = useState({ email: '', password: '', name: '', phone: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Config & Stats
  const [homeConfig, setHomeConfig] = useState({ topBanner: '', leftBanner: '', rightBanner: '', logoTitleImage: '' });
  const [realVisitorCount, setRealVisitorCount] = useState(0); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, [setUser]);

  // Load Config & Stats
  useEffect(() => {
      const fetchHomeConfig = async () => {
          try {
              const docSnap = await getDoc(doc(firestore, "system_config", "homepage"));
              if (docSnap.exists()) setHomeConfig(docSnap.data());
          } catch (e) {}
      };
      fetchHomeConfig();

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

  // --- AUTH HANDLERS ---
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthModal(false);
    } catch (error) { setAuthError("Đăng nhập Google thất bại!"); }
  };

  const handleAuthSubmit = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      setAuthError('');
      setAuthSuccess('');

      try {
          if (authMode === 'LOGIN') {
              await signInWithEmailAndPassword(auth, authData.email, authData.password);
              router.push('/dashboard');
          } 
          else if (authMode === 'REGISTER') {
              // 1. Tạo tài khoản Auth
              const userCredential = await createUserWithEmailAndPassword(auth, authData.email, authData.password);
              const newUser = userCredential.user;

              // 2. Cập nhật tên hiển thị
              await updateProfile(newUser, { displayName: authData.name });

              // [LOGIC MỚI] 3. Tự động thêm vào danh sách cho phép (allowed_emails) với hạn 180 ngày
              const expiredDate = new Date();
              expiredDate.setDate(expiredDate.getDate() + 180); // Cộng thêm 180 ngày

              await addDoc(collection(firestore, "allowed_emails"), {
                  email: authData.email,
                  name: authData.name, // Lưu tên để hiển thị trong Admin
                  phone: authData.phone, // Lưu SĐT
                  createdAt: serverTimestamp(),
                  expiredAt: expiredDate, // Hạn dùng
                  addedBy: 'System (Self-Register)',
                  role: 'TEACHER'
              });

              // 4. Lưu thông tin profile (user_configs)
              await setDoc(doc(firestore, "user_configs", newUser.uid), {
                  email: authData.email,
                  phone: authData.phone,
                  displayName: authData.name,
                  createdAt: serverTimestamp(),
                  role: 'TEACHER', 
                  status: 'ACTIVE'
              }, { merge: true });

              // 5. Reload để cập nhật profile
              await newUser.reload();
              setUser(auth.currentUser);
              
              setAuthSuccess("Đăng ký thành công! Bạn được tặng 180 ngày sử dụng.");
              setTimeout(() => router.push('/dashboard'), 1500);
          } 
          else if (authMode === 'FORGOT') {
              await sendPasswordResetEmail(auth, authData.email);
              setAuthSuccess(`Đã gửi link khôi phục đến ${authData.email}. Vui lòng kiểm tra hộp thư.`);
          }
      } catch (error) {
          console.error(error);
          let msg = "Đã có lỗi xảy ra.";
          if(error.code === 'auth/email-already-in-use') msg = "Email này đã được sử dụng.";
          if(error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = "Sai tài khoản hoặc mật khẩu.";
          if(error.code === 'auth/weak-password') msg = "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
          setAuthError(msg);
      } finally {
          setAuthLoading(false);
      }
  };

  // --- GAME PORTAL HANDLERS ---
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

  // --- RENDER HELPERS ---
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
            className={`group relative w-full h-full min-h-[100px] cursor-pointer rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-8 flex flex-col items-center justify-center`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`absolute inset-0 border-2 ${theme.border} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${theme.shadow} shadow-lg`}></div>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-40 group-hover:opacity-60 transition-opacity`}></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>

            <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
                <div className={`p-2 rounded-xl bg-black/40 border border-white/10 mb-1 group-hover:scale-110 transition-transform duration-300 ${theme.shadow} shadow-md`}>
                    <Icon size={22} className={`${theme.icon} drop-shadow-md`} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm md:text-base font-black italic uppercase text-white tracking-tighter leading-none mb-1 drop-shadow-lg">
                    {title}
                </h3>
                <p className={`text-[9px] font-bold uppercase tracking-[0.2em] ${theme.text} opacity-80 group-hover:opacity-100`}>{subtitle}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden flex flex-col">
      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-black -z-20"></div>
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 -z-10 pointer-events-none"></div>

      {homeConfig.leftBanner && (<div className="fixed top-0 left-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.leftBanner} className="w-full h-full object-cover opacity-80 mask-image-right"/></div>)}
      {homeConfig.rightBanner && (<div className="fixed top-0 right-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.rightBanner} className="w-full h-full object-cover opacity-80 mask-image-left"/></div>)}

      {/* HEADER */}
      <header className="h-[70px] shrink-0 z-[100] transition-all duration-300 bg-black/10 backdrop-blur-sm border-b border-white/5 shadow-[0_5px_30px_rgba(0,0,0,0.5)] relative">
          {homeConfig.topBanner && (
              <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-10"></div>
                  <img src={homeConfig.topBanner} className="w-full h-full object-cover object-center opacity-100"/>
              </div>
          )}
          
          <div className="relative z-20 container mx-auto h-full px-4 md:px-6 flex justify-between items-center">
              <div className="flex items-center gap-4">
                  {homeConfig.logoTitleImage ? (
                      <img src={homeConfig.logoTitleImage} alt="Logo" className="h-10 md:h-12 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform"/>
                  ) : (
                      <div className="flex items-center gap-2 md:gap-3 group cursor-pointer">
                        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-2 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/10 group-hover:rotate-12 transition-transform duration-500"><Gamepad2 className="text-white" size={20} /></div>
                        <div className="leading-none">
                            <h1 className="text-lg md:text-xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">ARENA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">EDU</span></h1>
                            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.4em] drop-shadow-sm">Connect</p>
                        </div>
                      </div>
                  )}
              </div>

              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-4 bg-black/40 pl-2 pr-6 py-1.5 rounded-full border border-white/10 backdrop-blur-md hover:bg-black/60 transition-all group shadow-lg">
                      <div className="relative">
                          {/* SỬ DỤNG UI AVATAR NẾU KHÔNG CÓ ẢNH */}
                          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random&color=fff&size=128`} className="w-8 h-8 rounded-full border-2 border-cyan-500 shadow-[0_0_10px_#22d3ee] object-cover" />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></div>
                      </div>
                      <div className="hidden md:block">
                          <div className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider">Commander</div>
                          <div className="text-xs font-bold text-white leading-none max-w-[120px] truncate">{user.displayName || user.email}</div>
                      </div>
                      <div className="h-6 w-px bg-white/20 mx-1"></div>
                      <div className="flex gap-2">
                          <button onClick={() => router.push('/dashboard')} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition shadow-lg" title="Trung tâm điều khiển"><Settings size={16}/></button>
                          <button onClick={() => signOut(auth)} className="p-1.5 bg-red-600/80 hover:bg-red-500 rounded-lg text-white transition shadow-lg" title="Đăng xuất"><LogOut size={16}/></button>
                      </div>
                  </div>
                ) : (
                  <button onClick={() => { setShowAuthModal(true); setAuthMode('LOGIN'); }} className="group relative h-10 w-10 hover:w-44 transition-all duration-500 ease-in-out bg-cyan-600/90 text-white rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-500 overflow-hidden flex items-center border border-cyan-400/30">
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
                      <div className="absolute left-0 w-10 h-10 flex items-center justify-center z-10 shrink-0">
                          <LogIn size={20} className="drop-shadow-md"/>
                      </div>
                      <span className="pl-10 pr-4 font-black text-xs uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                          GV Đăng nhập
                      </span>
                  </button>
                )}
              </div>
          </div>
      </header>
{/* BẮT ĐẦU THÊM MỚI: THANH CHỮ CHẠY THÔNG BÁO */}
      {homeConfig.marqueeText && (
          <div className="w-full bg-gradient-to-r from-red-600 to-orange-600 border-b border-orange-500/50 text-white overflow-hidden flex items-center h-6 md:h-8 shrink-0 relative z-40 shadow-sm">
              <div className="animate-marquee whitespace-nowrap font-bold text-[10px] md:text-xs tracking-widest drop-shadow-md flex items-center gap-3">
                  <Zap size={12} className="text-yellow-300 inline" fill="currentColor" />
                  
                  {/* [ĐÃ SỬA Ở ĐÂY] Cho phép render HTML để gán link */}
                  <span dangerouslySetInnerHTML={{ __html: homeConfig.marqueeText }} />
                  
                  <Zap size={12} className="text-yellow-300 inline" fill="currentColor" />
              </div>
          </div>
      )}
      {/* KẾT THÚC THÊM MỚI */}
   
      {/* 2. BODY CONTENT */}
      <div className="flex-1 w-full 2xl:max-w-[70%] mx-auto flex flex-col px-4 md:px-8 pt-4 pb-2 justify-between overflow-hidden">
            {/* NAV LUYỆN TẬP */}
            <div className="shrink-0 w-full bg-black/80 backdrop-blur-xl border-2 border-red-600/50 rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.4)] animate-in fade-in slide-in-from-top-4 relative z-20 min-h-[110px] md:h-[90px]">
                <div className="bg-gradient-to-br from-red-700 to-orange-800 p-2 w-full md:w-40 flex flex-row md:flex-col items-center justify-center text-center shrink-0 relative overflow-hidden group cursor-default z-20 shadow-2xl border-b border-red-500/30 md:border-b-0 md:border-r">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
                    <Target size={20} className="text-yellow-300 mr-2 md:mr-0 md:mb-1 animate-pulse drop-shadow-[0_0_10px_#facc15]"/>
                    <h2 className="text-sm md:text-lg font-black uppercase text-white leading-none tracking-tighter drop-shadow-md">Luyện Tập</h2>
                </div>
                <div className="flex-1 flex items-center justify-center p-1 md:p-0">
                    <div className="flex flex-wrap md:flex-nowrap w-full justify-center md:h-full">
                        {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
                            <button key={grade} onClick={() => handleGradeClick(grade)} className="group relative flex-1 min-w-[45px] md:min-w-[60px] h-12 md:h-full flex flex-col items-center justify-center transition-all duration-300 border border-red-900/30 md:border-0 md:border-l active:scale-95 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-red-900 via-red-800 to-orange-900 transition-all duration-500 group-hover:opacity-0"></div>
                                <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-orange-500 to-yellow-500 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-pulse group-hover:brightness-110"></div>
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                                <div className="relative z-10 transform group-hover:-translate-y-1 transition-transform duration-300 flex flex-col items-center">
                                    <span className="text-xl md:text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-orange-300 group-hover:from-white group-hover:to-yellow-300 transition-all duration-300 group-hover:scale-110 drop-shadow-lg">{grade}</span>
                                    <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-red-300 opacity-70 group-hover:opacity-100 group-hover:text-yellow-100 transition-all duration-300 whitespace-nowrap">Lớp</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* B. GRID GAMES */}
            <div className="flex-1 py-3 md:py-4 min-h-0"> 
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full h-full">
                    <CyberCard title="Chiến Binh Arena" subtitle="Đấu trường sinh tử" icon={Sword} color="purple" delay={0} onClick={() => openGamePortal('CLASSIC')}/>
                    <CyberCard title="Biệt Đội Arena" subtitle="Hợp sức tác chiến" icon={Shield} color="orange" delay={100} onClick={() => openGamePortal('RACE')}/>
                    <CyberCard title="Nhanh Như Chớp" subtitle="Tốc độ sấm sét" icon={Zap} color="cyan" delay={200} onClick={() => openGamePortal('LIGHTNING')}/>
                    <CyberCard title="Arena Thi Online" subtitle="Khảo thí thi online" icon={BookOpen} color="green" delay={300} onClick={() => router.push('/exam')}/>
                    <CyberCard title="Bảng Tương Tác" subtitle="Kết nối thời gian thực" icon={Users} color="blue" delay={400} onClick={() => router.push('/connect')}/>
                    <CyberCard title="Cổng Nộp Bài" subtitle="Dành cho học sinh" icon={UploadCloud} color="pink" delay={500} onClick={() => router.push('/submit')}/>
                </div>
            </div>

            {/* C. FOOTER BAR */}
            <div className="shrink-0 w-full bg-black/80 backdrop-blur-xl border-t-2 border-cyan-600/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.1)] animate-in fade-in slide-in-from-bottom-4 relative z-20 h-[70px] md:h-[80px]">
                <div className="grid grid-cols-8 w-full h-full bg-slate-900/50">
                    {[...Array(8)].map((_, index) => {
                        const isSpin = index === 0;
                        const isVote = index === 1;
                        const isGrade = index >= 2 && index <= 6; 
                        const gradeNum = isGrade ? index - 1 : null; 

                        const handleClick = () => {
                            if (isSpin) router.push('/bottom/SpinWheel');
                            else if (isVote) router.push('/bottom/VoteArena');
                            else if (isGrade) router.push(`/training?grade=${gradeNum}`);
                        };

                        return (
                            <button key={index} onClick={handleClick} className={`group relative w-full h-full flex flex-col items-center justify-center transition-all duration-300 border-r border-cyan-900/30 last:border-r-0 overflow-hidden ${isSpin||isVote||isGrade ? 'cursor-pointer' : 'cursor-default bg-transparent opacity-50'} ${isGrade ? 'hover:flex-[1.1]' : ''}`}>
                                {(isSpin || isVote) && <div className="absolute inset-0 bg-gradient-to-b from-cyan-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500"></div>}
                                {isGrade && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-b from-red-900/40 to-orange-900/40 group-hover:opacity-0 transition-opacity"></div>
                                        <div className="absolute inset-0 bg-gradient-to-b from-red-600/80 via-orange-500/80 to-yellow-500/80 opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                                    </>
                                )}
                                <div className="relative z-10 flex flex-col items-center gap-0.5 justify-center h-full w-full">
                                    {isSpin ? (<><Disc size={20} className="text-cyan-300 group-hover:rotate-180 transition-transform duration-700"/><span className="text-[9px] font-black uppercase text-cyan-100 tracking-wider leading-none text-center mt-1">Vòng Xoay</span></>) : 
                                     isVote ? (<><BarChart2 size={20} className="text-cyan-300 group-hover:scale-110 transition-transform duration-300"/><span className="text-[9px] font-black uppercase text-cyan-100 tracking-wider leading-none text-center mt-1">Vote</span></>) : 
                                     isGrade ? (<><span className="text-[8px] font-bold text-red-300 group-hover:text-yellow-100 uppercase tracking-widest leading-none mb-0.5">Luyện Tập</span><span className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-orange-300 group-hover:text-white drop-shadow-md leading-none">{gradeNum}</span><span className="text-[8px] font-bold text-red-300 group-hover:text-yellow-100 uppercase tracking-widest leading-none mb-0.5">Lớp</span></>) : 
                                     (<><span className="text-[8px] font-bold text-red-300 group-hover:text-yellow-100 uppercase tracking-widest leading-none mb-0.5">LIÊN HỆ Phone/zalo</span><span className="text-[18px] font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-orange-300 group-hover:text-white drop-shadow-md leading-none">0383477162</span></>)}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
      </div>

      {/* FOOTER */}
<footer className="h-[30px] shrink-0 bg-[#0a0a0a]/90 backdrop-blur border-t border-white/5 relative z-20 flex items-center justify-center px-6">
  <p className="text-center text-slate-600 text-[8px] font-bold uppercase tracking-[0.3em] hover:text-cyan-600 transition-colors cursor-default leading-tight">
    Lượt truy cập: <span className="text-white font-mono">{realVisitorCount.toLocaleString()}</span>
    <br />
    © 2026 Arena Edu Connect - 0383477162
  </p>
</footer>


      {/* MODAL PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-cyan-500/30 p-8 rounded-[3rem] w-full max-w-md shadow-[0_0_100px_rgba(6,182,212,0.2)] relative animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
            <button onClick={() => setShowPinModal(false)} className="absolute top-5 right-5 bg-white/5 p-2 rounded-full hover:bg-red-500 hover:text-white transition text-slate-400"><X size={20}/></button>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">{targetGame === 'CLASSIC' ? 'Chiến Binh' : targetGame === 'RACE' ? 'Biệt Đội' : 'Nhanh Như Chớp'}</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nhập mã PIN để tham chiến</p>
            </div>
            <form onSubmit={handleJoinGame} className="space-y-6">
              <input autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-[#050505] border-2 border-slate-700 text-center text-5xl font-black text-white py-5 rounded-2xl focus:border-cyan-500 focus:shadow-[0_0_30px_rgba(6,182,212,0.3)] outline-none transition-all font-mono tracking-[0.2em] placeholder:text-slate-800 placeholder:tracking-normal" placeholder="000000" maxLength={6}/>
              <button type="submit" className={`w-full py-5 rounded-2xl font-black text-xl uppercase italic shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 bg-white text-black hover:bg-cyan-400 hover:shadow-[0_0_20px_#22d3ee]`}>Vào Ngay <ArrowRight size={24} strokeWidth={3}/></button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL AUTHENTICATION (NEW) --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-cyan-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-[0_0_100px_rgba(6,182,212,0.2)] relative animate-in zoom-in-95 duration-300 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
                <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 bg-white/5 p-2 rounded-full hover:bg-red-500 hover:text-white transition text-slate-400"><X size={18}/></button>
                
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                        {authMode === 'LOGIN' ? 'Đăng Nhập Giáo Viên' : authMode === 'REGISTER' ? 'Đăng Ký Dành Cho Giáo viên' : 'Quên Mật Khẩu'}
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Học sinh đăng nhập/đăng ký trong Luyện Tập</p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {authMode === 'REGISTER' && (
                        <>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                                <input required type="text" placeholder="Họ và tên" value={authData.name} onChange={(e) => setAuthData({...authData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold"/>
                            </div>
                            <div className="relative">
                                <Phone className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                                <input required type="tel" placeholder="Số điện thoại" value={authData.phone} onChange={(e) => setAuthData({...authData, phone: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold"/>
                            </div>
                        </>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                        <input required type="email" placeholder="Email" value={authData.email} onChange={(e) => setAuthData({...authData, email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold"/>
                    </div>

                    {authMode !== 'FORGOT' && (
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                            <input required type="password" placeholder="Mật khẩu" value={authData.password} onChange={(e) => setAuthData({...authData, password: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold"/>
                        </div>
                    )}

                    {authError && <div className="text-red-400 text-xs font-bold bg-red-900/20 p-3 rounded-lg flex items-center gap-2 border border-red-500/30"><AlertCircle size={14}/> {authError}</div>}
                    {authSuccess && <div className="text-green-400 text-xs font-bold bg-green-900/20 p-3 rounded-lg flex items-center gap-2 border border-green-500/30"><CheckCircle size={14}/> {authSuccess}</div>}

                    <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (authMode === 'LOGIN' ? 'Đăng Nhập' : authMode === 'REGISTER' ? 'Đăng Ký Ngay' : 'Gửi Link')}
                    </button>
                </form>

                <div className="mt-6 flex flex-col gap-3 text-center border-t border-white/10 pt-4">
                    {authMode === 'LOGIN' && (
                        <>
                            <button type="button" onClick={handleGoogleLogin} className="w-full bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all shadow-md">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/> Đăng nhập bằng Google
                            </button>
                            <div className="flex justify-between text-xs font-bold text-slate-400 mt-2">
                                <button onClick={() => setAuthMode('REGISTER')} className="hover:text-cyan-400 transition-colors">Đăng ký tài khoản mới</button>
                                <button onClick={() => setAuthMode('FORGOT')} className="hover:text-cyan-400 transition-colors">Quên mật khẩu?</button>
                            </div>
                        </>
                    )}
                    {authMode !== 'LOGIN' && (
                        <button onClick={() => setAuthMode('LOGIN')} className="text-xs font-bold text-cyan-400 hover:underline mt-2">Quay lại Đăng nhập</button>
                    )}
                </div>
            </div>
        </div>
      )}
      {/* CSS CHO HIỆU ỨNG CHỮ CHẠY */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
          will-change: transform;
        }
        .animate-marquee:hover {
          animation-play-state: paused; /* Tạm dừng chữ khi người dùng trỏ chuột vào */
        }
      `}</style>
 
    </div>
  );
}