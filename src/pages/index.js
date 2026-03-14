import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
    signInWithPopup, signOut, onAuthStateChanged, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    sendPasswordResetEmail, updateProfile, 
    sendEmailVerification // [MỚI] Thêm hàm gửi email xác thực
} from 'firebase/auth';
import { auth, googleProvider, firestore } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'; 
import useAuthStore from '@/store/useAuthStore';
import { 
    LogIn, LogOut, Sword, Shield, BookOpen, Users, X, ArrowRight, 
    Gamepad2, Settings, Zap, Target, Disc, BarChart2,
    Mail, Lock, User, Phone, CheckCircle, AlertCircle, Trophy
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  const expireDate6Months = new Date();
  expireDate6Months.setMonth(expireDate6Months.getMonth() + 6);
  const expireDateString = expireDate6Months.toISOString().split('T')[0];
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetGame, setTargetGame] = useState(null); 
  const [pin, setPin] = useState('');
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('LOGIN'); 
  const [authData, setAuthData] = useState({ email: '', password: '', name: '', phone: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

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

 const handleGoogleLogin = async () => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          const userRef = doc(firestore, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
              await setDoc(userRef, {
                  name: user.displayName,
                  email: user.email,
                  role: 'teacher',
                  status: 'active',
                  createdAt: serverTimestamp(),
                  expireDate: expireDateString 
              });
              setShowAuthModal(false);
              router.push('/setup-config'); 
          } else {
              setShowAuthModal(false);
              router.push('/dashboard');
          }
      } catch (error) {
          console.error(error);
      }
  };

  const handleAuthSubmit = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      setAuthError(null);
      setAuthSuccess(null);

      try {
          if (authMode === 'REGISTER') {
              const userCredential = await createUserWithEmailAndPassword(auth, authData.email, authData.password);
              const user = userCredential.user;
              await updateProfile(user, { displayName: authData.name });

              // [MỚI] GỬI EMAIL XÁC THỰC SAU KHI TẠO TÀI KHOẢN
              await sendEmailVerification(user);

              await setDoc(doc(firestore, 'users', user.uid), {
                  name: authData.name,
                  email: authData.email,
                  phone: authData.phone || "",
                  role: 'teacher',   
                  status: 'active', 
                  expireDate: expireDateString, 
                  createdAt: serverTimestamp()
              });

              // [MỚI] ĐĂNG XUẤT NGAY ĐỂ ÉP NGƯỜI DÙNG VÀO MAIL KÍCH HOẠT
              await signOut(auth);
              
              setAuthSuccess("Đăng ký thành công! Vui lòng kiểm tra hộp thư Email (kể cả Thư rác/Spam) để kích hoạt tài khoản.");
              
              // Chuyển về màn hình đăng nhập sau 5 giây
              setTimeout(() => {
                  setAuthMode('LOGIN');
                  setAuthSuccess('');
                  setAuthData({...authData, password: ''}); // Xóa pass cho an toàn
              }, 5000);

      } else if (authMode === 'LOGIN') {
              const userCredential = await signInWithEmailAndPassword(auth, authData.email, authData.password);
              const user = userCredential.user;

              // 1. KIỂM TRA TÀI KHOẢN CŨ HAY MỚI (Luật Đặc Xá)
              const creationTime = new Date(user.metadata.creationTime).getTime();
              // Mốc thời gian trước lúc cập nhật tính năng xác thực (VD: lấy ngày 5/3/2026)
              const updateTime = new Date('2026-03-05T00:00:00').getTime(); 
              const isOldAccount = creationTime < updateTime;

              // 2. KIỂM TRA XÁC THỰC MAIL (Chỉ áp dụng với tài khoản MỚI)
              if (!isOldAccount && !user.emailVerified) {
                  // Tự động gửi lại mail phòng khi user làm thất lạc
                  try { await sendEmailVerification(user); } catch(e) { console.error(e) }

                  await signOut(auth); 
                  setAuthError("Tài khoản chưa được kích hoạt! Hệ thống vừa gửi lại Email xác thực, vui lòng check hộp thư (kể cả Thư Rác) để vào hệ thống.");
                  setAuthLoading(false);
                  return; 
              }

              // 3. KIỂM TRA XEM ĐÃ CẤU HÌNH SETUP-CONFIG CHƯA (Dành cho cả tài khoản cũ & mới)
              const configRef = doc(firestore, 'user_configs', user.uid);
              const configSnap = await getDoc(configRef);

              setShowAuthModal(false);
              
              if (!configSnap.exists()) {
                  router.push('/setup-config');
              } else {
                  router.push('/dashboard');
              }
          }
      } catch (error) {
          if (error.code === 'auth/invalid-credential') setAuthError("Email hoặc mật khẩu không chính xác!");
          else if (error.code === 'auth/email-already-in-use') setAuthError("Email này đã được đăng ký trước đó!");
          else setAuthError(error.message);
      } finally {
          setAuthLoading(false);
      }
  };

  const handleResetPassword = async (e) => {
      e.preventDefault();
      setAuthError(null);
      setAuthSuccess(null);
      
      if (!authData.email) {
          setAuthError("Vui lòng nhập Email để khôi phục mật khẩu!");
          return;
      }
      setAuthLoading(true);
      try {
          await sendPasswordResetEmail(auth, authData.email);
          setAuthSuccess("Đã gửi link khôi phục mật khẩu! Vui lòng kiểm tra hộp thư của bạn.");
          setTimeout(() => {
              setAuthMode('LOGIN');
              setAuthSuccess('');
          }, 3000);
      } catch (error) {
          if (error.code === 'auth/user-not-found') setAuthError("Email này chưa được đăng ký!");
          else setAuthError("Lỗi: " + error.message);
      } finally {
          setAuthLoading(false);
      }
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
            className={`group relative w-full h-full cursor-pointer rounded-xl md:rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`absolute inset-0 border-2 ${theme.border} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl md:rounded-2xl ${theme.shadow} shadow-lg`}></div>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-40 group-hover:opacity-60 transition-opacity`}></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>

            <div className="relative z-10 flex flex-col items-center justify-center p-1 md:p-3 text-center h-full">
                <div className={`p-1.5 md:p-3 rounded-lg md:rounded-xl bg-black/40 border border-white/10 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-300 ${theme.shadow} shadow-md`}>
                    <Icon size={20} className={`md:w-7 md:h-7 ${theme.icon} drop-shadow-md`} strokeWidth={1.5} />
                </div>
                <h3 className="text-[10px] sm:text-xs md:text-sm font-black italic uppercase text-white tracking-tighter leading-tight drop-shadow-lg">
                    {title}
                </h3>
                <p className={`text-[7px] md:text-[9px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] ${theme.text} opacity-80 group-hover:opacity-100 hidden sm:block mt-0.5`}>{subtitle}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden flex flex-col">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-[#050505] to-black -z-20"></div>
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 -z-10 pointer-events-none"></div>
      
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {homeConfig.leftBanner && (<div className="fixed top-0 left-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.leftBanner} className="w-full h-full object-cover opacity-80 mask-image-right"/></div>)}
      {homeConfig.rightBanner && (<div className="fixed top-0 right-0 w-[15%] h-full hidden 2xl:block z-0 pointer-events-none"><img src={homeConfig.rightBanner} className="w-full h-full object-cover opacity-80 mask-image-left"/></div>)}

      <header className="h-[50px] md:h-[60px] shrink-0 z-[100] transition-all duration-300 bg-black/40 backdrop-blur-md border-b border-white/5 shadow-lg relative">
          {homeConfig.topBanner && (
              <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-10"></div>
                  <img src={homeConfig.topBanner} className="w-full h-full object-cover object-center opacity-100"/>
              </div>
          )}
          
          <div className="relative z-20 container mx-auto h-full px-2 md:px-6 flex justify-between items-center">
              <div className="flex items-center gap-2 md:gap-4">
                  {homeConfig.logoTitleImage ? (
                      <img src={homeConfig.logoTitleImage} alt="Logo" className="h-6 md:h-10 object-contain hover:scale-105 transition-transform"/>
                  ) : (
                      <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-1.5 md:p-2 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-white/10 group-hover:rotate-12 transition-transform"><Gamepad2 className="text-white w-4 h-4 md:w-5 md:h-5" /></div>
                        <div className="leading-none">
                            <h1 className="text-sm md:text-xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">ARENA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">EDU</span></h1>
                            <p className="text-[6px] md:text-[8px] font-bold text-slate-300 uppercase tracking-[0.4em]">Connect</p>
                        </div>
                      </div>
                  )}
              </div>

              <div className="flex items-center">
                {user ? (
                  <div className="flex items-center gap-2 md:gap-4 bg-black/60 pl-1.5 pr-2 md:pr-6 py-1 md:py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                      <div className="relative">
                          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random&color=fff&size=128`} className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-cyan-500 object-cover" />
                          <div className="absolute bottom-0 right-0 w-2 h-2 md:w-2.5 md:h-2.5 bg-green-500 border-2 border-black rounded-full hidden md:block"></div>
                      </div>
                      <div className="hidden md:block">
                          <div className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider">Commander</div>
                          <div className="text-[10px] md:text-xs font-bold text-white leading-none max-w-[100px] truncate">{user.displayName || user.email}</div>
                      </div>
                      <div className="flex gap-1 md:gap-2 ml-1">
                          <button onClick={() => router.push('/dashboard')} className="p-1 md:p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition"><Settings size={12} className="md:w-4 md:h-4"/></button>
                          <button onClick={() => signOut(auth)} className="p-1 md:p-1.5 bg-red-600/80 hover:bg-red-500 rounded text-white transition"><LogOut size={12} className="md:w-4 md:h-4"/></button>
                      </div>
                  </div>
                ) : (
                  <button onClick={() => { setShowAuthModal(true); setAuthMode('LOGIN'); }} className="group relative h-7 w-7 md:h-10 md:w-10 hover:w-28 md:hover:w-44 transition-all duration-500 bg-cyan-600/90 text-white rounded-lg md:rounded-xl hover:bg-cyan-500 overflow-hidden flex items-center border border-cyan-400/30">
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
                      <div className="absolute left-0 w-7 h-7 md:w-10 md:h-10 flex items-center justify-center z-10 shrink-0">
                          <LogIn size={14} className="md:w-5 md:h-5 drop-shadow-md"/>
                      </div>
                      <span className="pl-7 md:pl-10 pr-2 font-black text-[8px] md:text-xs uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                          Đăng nhập
                      </span>
                  </button>
                )}
              </div>
          </div>
      </header>

      {homeConfig.marqueeText && (
          <div className="w-full bg-gradient-to-r from-red-600 to-orange-600 border-b border-orange-500/50 text-white overflow-hidden flex items-center h-5 md:h-8 shrink-0 relative z-40">
              <div className="animate-marquee whitespace-nowrap font-bold text-[8px] md:text-xs tracking-widest drop-shadow-md flex items-center gap-3">
                  <Zap size={10} className="text-yellow-300 inline md:w-3 md:h-3" fill="currentColor" />
                  <span dangerouslySetInnerHTML={{ __html: homeConfig.marqueeText }} />
                  <Zap size={10} className="text-yellow-300 inline md:w-3 md:h-3" fill="currentColor" />
              </div>
          </div>
      )}
        
      <div className="flex-1 w-full lg:max-w-[80%] 2xl:max-w-[70%] mx-auto flex flex-col gap-2 md:gap-3 px-2 md:px-4 py-2 min-h-0 overflow-hidden">
          
          <div className="w-full grid grid-cols-4 md:grid-cols-8 gap-1.5 md:gap-2 shrink-0 relative z-20">
              {[...Array(8)].map((_, index) => {
                  const isKHBD = index === 0;
                  const isTest = index === 1;
                  const isMixer = index === 2; 
                  const isDuplicate = index === 3; 
                  const isquestion = index === 4; 
                  const hoclieu= index === 5; 
                  const copydrive= index === 6; 
                  const isSubmit = index === 7; 
                  
                  const title = isKHBD ? "Soạn KHBD" : 
                                isTest ? "Soạn Đề KT" : 
                                isMixer ? "Trộn Đề" : 
                                isDuplicate ? "Nhân Bản Đề" : 
                                isquestion ? "Tạo câu hỏi" : 
                                hoclieu ? "Học liệu" : 
                                copydrive ? "Drive Copy" :
                                isSubmit ? "Cổng Nộp Bài" : "";

                  const handleMenuClick = () => {
                      if (title) {
                          if (!user) { setShowAuthModal(true); setAuthMode('LOGIN'); } 
                          else {
                              if (isKHBD) router.push('/lesson-plan');
                              if (isTest) router.push('/create-test');
                              if (isMixer) router.push('/mixer'); 
                              if (isDuplicate) router.push('/clone-test');
                              if (isquestion) router.push('/generate-questions');
                              if (hoclieu) router.push('/arena-hoc-lieu');
                                if (copydrive) router.push('/copydrive');
                              if (isSubmit) router.push('/submit');
                          }
                      }
                  };

                  return (
                      <button 
                          key={index} onClick={handleMenuClick}
                          className={`relative group h-[40px] md:h-[50px] rounded-lg md:rounded-xl font-black text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-wider md:tracking-widest text-white transition-all transform outline-none border-x border-t border-orange-400/80 border-b-2 md:border-b-4 border-b-red-900 overflow-hidden p-1 shadow-md
                              ${title ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default opacity-80'}`}
                      >
                          <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-orange-600 to-yellow-500"></div>
                          <div className="absolute inset-0 bg-gradient-to-t from-yellow-300/0 to-yellow-200/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent"></div>
                          
                          {title && (
                              <span className="relative z-10 drop-shadow-md leading-tight flex items-center justify-center text-center h-full w-full">
                                  {title}
                              </span>
                          )}
                      </button>
                  );
              })}
          </div>

          <div className="shrink-0 w-full bg-black/80 backdrop-blur-xl border-2 border-red-600/50 rounded-lg md:rounded-2xl flex flex-row overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-4 relative z-20 h-[50px] md:h-[65px]">
                <div className="bg-gradient-to-br from-red-700 to-orange-800 px-2 md:px-3 w-[100px] sm:w-[120px] md:w-32 h-full flex items-center justify-center text-center shrink-0 border-r border-red-500/30">
                    <Target size={14} className="text-yellow-300 mr-1 md:mr-2 md:mb-0.5 animate-pulse drop-shadow-md md:w-5 md:h-5"/>
                    <h2 className="text-[10px] sm:text-xs md:text-sm font-black uppercase text-white leading-none tracking-tighter drop-shadow-md">Luyện Tập</h2>
                </div>
                
                <div className="flex-1 flex overflow-x-auto no-scrollbar bg-slate-900/30 h-full">
                    <div className="flex w-max min-w-full md:w-full h-full">
                        {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
                            <button key={grade} onClick={() => handleGradeClick(grade)} className="group relative flex-1 min-w-[45px] sm:min-w-[50px] md:min-w-[60px] h-full flex flex-col items-center justify-center transition-all border-l border-red-900/30 first:border-0 active:bg-red-900/40 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-red-900/50 via-red-800/50 to-orange-900/50 md:opacity-100 opacity-0 group-hover:opacity-0"></div>
                                <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-orange-500 to-yellow-500 opacity-0 group-hover:opacity-100 transition-all group-hover:animate-pulse"></div>
                                <div className="relative z-10 flex flex-col items-center group-hover:-translate-y-0.5 transition-transform mt-0.5">
                                    <span className="text-xl md:text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-orange-300 group-hover:from-white group-hover:to-yellow-300 drop-shadow-md leading-none">{grade}</span>
                                    <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest text-red-300 opacity-70 group-hover:opacity-100 group-hover:text-yellow-100 mt-0.5 leading-none">Lớp</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0"> 
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 w-full h-full">
                  <CyberCard title="Chiến Binh Arena" subtitle="Đấu trường sinh tử" icon={Sword} color="purple" delay={0} onClick={() => openGamePortal('CLASSIC')}/>
                  <CyberCard title="Biệt Đội Arena" subtitle="Hợp sức tác chiến" icon={Shield} color="orange" delay={100} onClick={() => openGamePortal('RACE')}/>
                  <CyberCard title="Nhanh Như Chớp" subtitle="Tốc độ sấm sét" icon={Zap} color="cyan" delay={200} onClick={() => openGamePortal('LIGHTNING')}/>
                  <CyberCard title="Arena Thi Online" subtitle="Khảo thí thi online" icon={BookOpen} color="green" delay={300} onClick={() => router.push('/exam')}/>
                  <CyberCard title="Bảng Tương Tác" subtitle="Kết nối thời gian thực" icon={Users} color="blue" delay={400} onClick={() => router.push('/connect')}/>
                  <CyberCard title="Arena Ôn Thi" subtitle="Hệ thống luyện thi PDF" icon={Trophy} color="pink" delay={500} onClick={() => router.push('/arena-on-thi')}/>
              </div>
          </div>
  <div className="w-full grid grid-cols-4 md:grid-cols-8 gap-1.5 md:gap-2 shrink-0 relative z-20">
              {[...Array(8)].map((_, index) => {
                  const iskeoco = index === 0;
                  const isTest = index === 1;
                  const isMixer = index === 2; 
                  const isDuplicate = index === 3; 
                  const isquestion = index === 4; 
                  const hoclieu= index === 5; 
                  const copydrive= index === 6; 
                  const isSubmit = index === 7; 
                  
                  const title = iskeoco ? "Game Kéo Co" : 
                                isTest ? " " : 
                                isMixer ? " " : 
                                isDuplicate ? " " : 
                                isquestion ? "" : 
                                hoclieu ? " " : 
                                copydrive ? "" :
                                isSubmit ? "" : "";

                  const handleMenuClick = () => {
                      if (title) {
                          if (!user) { setShowAuthModal(true); setAuthMode('LOGIN'); } 
                          else {
                              if (iskeoco) router.push('/play/tug-of-war');
                              if (isTest) router.push('/create-test');
                              if (isMixer) router.push('/mixer'); 
                              if (isDuplicate) router.push('/clone-test');
                              if (isquestion) router.push('/generate-questions');
                              if (hoclieu) router.push('/arena-hoc-lieu');
                                if (copydrive) router.push('/copydrive');
                              if (isSubmit) router.push('/submit');
                          }
                      }
                  };

                  return (
                      <button 
                          key={index} onClick={handleMenuClick}
                          className={`relative group h-[40px] md:h-[50px] rounded-lg md:rounded-xl font-black text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-wider md:tracking-widest text-white transition-all transform outline-none border-x border-t border-orange-400/80 border-b-2 md:border-b-4 border-b-red-900 overflow-hidden p-1 shadow-md
                              ${title ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default opacity-80'}`}
                      >
                          <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-orange-600 to-yellow-500"></div>
                          <div className="absolute inset-0 bg-gradient-to-t from-yellow-300/0 to-yellow-200/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent"></div>
                          
                          {title && (
                              <span className="relative z-10 drop-shadow-md leading-tight flex items-center justify-center text-center h-full w-full">
                                  {title}
                              </span>
                          )}
                      </button>
                  );
              })}
          </div>
          <div className="shrink-0 w-full bg-black/80 backdrop-blur-xl border-t-2 border-cyan-600/50 rounded-xl md:rounded-2xl overflow-hidden shadow-lg relative z-20 h-[55px] md:h-[70px] mt-auto">
              <div className="flex w-full h-full bg-slate-900/50 overflow-x-auto no-scrollbar md:grid md:grid-cols-8">
                  {[...Array(8)].map((_, index) => {
                      const isSpin = index === 0;
                      const isVote = index === 1;
                      const isPracticeBox = index === 2; 
                      const isGrade = index >= 3 && index <= 7;
                      const gradeNum = isGrade ? index - 2 : null;

                      const handleClick = () => {
                          if (isSpin) router.push('/bottom/SpinWheel');
                          else if (isVote) router.push('/bottom/VoteArena');
                          else if (isGrade) router.push(`/training?grade=${gradeNum}`);
                      };

                      return (
                          <button key={index} onClick={handleClick} className={`group relative h-full flex flex-col items-center justify-center transition-colors border-r border-cyan-900/30 last:border-r-0 cursor-pointer min-w-[65px] md:min-w-0 flex-1 flex-shrink-0`}>
                              
                              {(isSpin || isVote || isPracticeBox) && <div className="absolute inset-0 bg-gradient-to-b from-cyan-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                              
                              {isGrade && (
                                  <>
                                      <div className="absolute inset-0 bg-gradient-to-b from-red-900/40 to-orange-900/40 group-hover:opacity-0 transition-opacity"></div>
                                      <div className="absolute inset-0 bg-gradient-to-b from-red-600/80 via-orange-500/80 to-yellow-500/80 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                  </>
                              )}
                              
                              <div className="relative z-10 flex flex-col items-center justify-center h-full w-full gap-0.5 md:gap-1">
                                  {isSpin ? (
                                      <><Disc size={16} className="md:w-6 md:h-6 text-cyan-300 group-hover:rotate-180 transition-transform duration-700"/><span className="text-[8px] md:text-[9px] font-black uppercase text-cyan-100 tracking-wider text-center leading-tight">Vòng Xoay</span></>
                                  ) : isVote ? (
                                      <><BarChart2 size={16} className="md:w-6 md:h-6 text-cyan-300 group-hover:scale-110 transition-transform"/><span className="text-[8px] md:text-[9px] font-black uppercase text-cyan-100 tracking-wider text-center leading-tight">Vote</span></>
                                  ) : isPracticeBox ? (
                                      <><Target size={16} className="md:w-6 md:h-6 text-emerald-400 group-hover:scale-110 transition-transform"/><span className="text-[8px] md:text-[10px] font-black uppercase text-emerald-200 tracking-wider text-center leading-tight">Luyện Tập</span></>
                                  ) : isGrade ? (
                                      <><span className="text-lg md:text-xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-orange-300 group-hover:text-white leading-none drop-shadow-md">{gradeNum}</span><span className="text-[7px] md:text-[8px] font-bold text-red-300 group-hover:text-yellow-100 uppercase tracking-widest leading-none">Lớp</span></>
                                  ) : null}
                              </div>
                          </button>
                      );
                  })}
              </div>
          </div>
      </div>

      <footer className="h-6 md:h-8 shrink-0 bg-[#0a0a0a]/90 backdrop-blur border-t border-white/5 flex items-center justify-center px-4 z-20">
        <p className="text-center text-slate-600 text-[8px] md:text-[9px] font-bold uppercase tracking-widest leading-none">
          Lượt truy cập: <span className="text-white font-mono">{realVisitorCount.toLocaleString()}</span> <br/>
           © 2026 Arena Edu Connect - 0383477162
        </p>
      </footer>

      {showPinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-cyan-500/30 p-6 md:p-8 rounded-[2rem] w-full max-w-md shadow-[0_0_50px_rgba(6,182,212,0.2)] relative animate-in zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
            <button onClick={() => setShowPinModal(false)} className="absolute top-4 right-4 bg-white/5 p-2 rounded-full hover:bg-red-500 hover:text-white transition text-slate-400"><X size={18}/></button>
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter mb-1">{targetGame === 'CLASSIC' ? 'Chiến Binh' : targetGame === 'RACE' ? 'Biệt Đội' : 'Nhanh Như Chớp'}</h2>
              <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Nhập mã PIN để tham chiến</p>
            </div>
            <form onSubmit={handleJoinGame} className="space-y-4 md:space-y-6">
              <input autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-[#050505] border-2 border-slate-700 text-center text-4xl md:text-5xl font-black text-white py-4 md:py-5 rounded-2xl focus:border-cyan-500 outline-none transition-all font-mono tracking-[0.2em] placeholder:text-slate-800 placeholder:tracking-normal" placeholder="000000" maxLength={6}/>
              <button type="submit" className={`w-full py-4 md:py-5 rounded-2xl font-black text-lg md:text-xl uppercase italic shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 bg-white text-black hover:bg-cyan-400`}>Vào Ngay <ArrowRight size={20} strokeWidth={3}/></button>
            </form>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-cyan-500/30 p-6 md:p-8 rounded-[2rem] w-full max-w-md shadow-[0_0_50px_rgba(6,182,212,0.2)] relative animate-in zoom-in-95">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
                <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 bg-white/5 p-2 rounded-full hover:bg-red-500 hover:text-white transition text-slate-400"><X size={18}/></button>
                
                <div className="text-center mb-6">
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase italic tracking-tighter">
                        {authMode === 'LOGIN' ? 'Đăng Nhập Giáo Viên' : authMode === 'REGISTER' ? 'Đăng Ký Giáo viên' : 'Quên Mật Khẩu'}
                    </h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Địa chỉ email phải đúng để kích hoạt tài khoản</p>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Học sinh đăng nhập/đăng ký trong Luyện Tập</p>
                </div>

                <form onSubmit={authMode === 'FORGOT' ? handleResetPassword : handleAuthSubmit} className="space-y-3 md:space-y-4">
                    {authMode === 'REGISTER' && (
                        <>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 text-slate-500" size={16}/>
                                <input required type="text" placeholder="Họ và tên" value={authData.name} onChange={(e) => setAuthData({...authData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2.5 md:py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold text-sm"/>
                            </div>
                            <div className="relative">
                                <Phone className="absolute left-4 top-3.5 text-slate-500" size={16}/>
                                <input required type="tel" placeholder="Số điện thoại" value={authData.phone} onChange={(e) => setAuthData({...authData, phone: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2.5 md:py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold text-sm"/>
                            </div>
                        </>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-500" size={16}/>
                        <input required type="email" placeholder="Email" value={authData.email} onChange={(e) => setAuthData({...authData, email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2.5 md:py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold text-sm"/>
                    </div>

                    {authMode !== 'FORGOT' && (
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-slate-500" size={16}/>
                            <input required type="password" placeholder="Mật khẩu" value={authData.password} onChange={(e) => setAuthData({...authData, password: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2.5 md:py-3 rounded-xl focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-bold text-sm"/>
                        </div>
                    )}

                    {authError && <div className="text-red-400 text-xs font-bold bg-red-900/20 p-2 md:p-3 rounded-lg flex items-center gap-2 border border-red-500/30"><AlertCircle size={14}/> {authError}</div>}
                    {authSuccess && <div className="text-green-400 text-xs font-bold bg-green-900/20 p-2 md:p-3 rounded-lg flex items-center gap-2 border border-green-500/30"><CheckCircle size={14}/> {authSuccess}</div>}

                    <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2.5 md:py-3 rounded-xl font-black uppercase shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                        {authLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (authMode === 'LOGIN' ? 'Đăng Nhập' : authMode === 'REGISTER' ? 'Đăng Ký' : 'Gửi Link Khôi Phục')}
                    </button>
                </form>

                <div className="mt-4 md:mt-6 flex flex-col gap-2 md:gap-3 text-center border-t border-white/10 pt-3 md:pt-4">
                    {authMode === 'LOGIN' && (
                        <>
                            <button type="button" onClick={handleGoogleLogin} className="w-full bg-white text-black py-2.5 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all shadow-md text-sm">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 md:w-5 md:h-5"/> Đăng nhập Google
                            </button>
                            <div className="flex justify-between text-[10px] md:text-xs font-bold text-slate-400 mt-1 md:mt-2">
                                <button onClick={() => setAuthMode('REGISTER')} className="hover:text-cyan-400 transition-colors">Tạo tài khoản</button>
                                <button onClick={() => setAuthMode('FORGOT')} className="hover:text-cyan-400 transition-colors">Quên mật khẩu?</button>
                            </div>
                        </>
                    )}
                    {authMode !== 'LOGIN' && (
                        <button onClick={() => { setAuthMode('LOGIN'); setAuthError(null); setAuthSuccess(null); }} className="text-xs font-bold text-cyan-400 hover:underline mt-1 md:mt-2">Quay lại Đăng nhập</button>
                    )}
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
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
          animation-play-state: paused; 
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}