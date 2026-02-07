import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from 'firebase/auth'; 
import { auth, firestore } from '@/lib/firebase';
import { 
    collection, query, where, getDocs, doc, onSnapshot, setDoc, 
    serverTimestamp, orderBy, limit, addDoc 
} from 'firebase/firestore';
import { 
    Flame, ChevronLeft, Trophy, Star, X, Gamepad2, Shield, Crown, 
    Swords, PlayCircle, LogIn, UserPlus, LogOut, Gift, LayoutGrid, 
    CircleDashed, DollarSign, Grid3X3, User, Phone, Lock, Eye, EyeOff, AlertCircle, KeyRound, Check
} from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';

// Hàm tạo email ảo
const createFakeEmail = (phone) => `${phone}@eduarena.vn`;

export default function TrainingPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [subjectsData, setSubjectsData] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // STATE AUTH
  const [authMode, setAuthMode] = useState(null); 
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Nhập SĐT, 2: Nhập Pass mới
  
  const [formData, setFormData] = useState({
      fullName: '', phone: '', password: '', confirmPassword: ''
  });
  
  const [studentProfile, setStudentProfile] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null); 

  // ... (Giữ nguyên logic Auth Listener, Lấy Grade, Fetch Data như cũ) ...
  // Để tiết kiệm không gian, tôi chỉ viết lại phần Logic AUTH mới bên dưới
  
  // 1. AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            const unsubProfile = onSnapshot(doc(firestore, "student_profiles", currentUser.uid), (doc) => {
                if (doc.exists()) setStudentProfile(doc.data());
            });
            return () => unsubProfile();
        } else {
            setStudentProfile(null);
        }
    });
    return () => unsubscribe();
  }, [setUser]);

  // 2. LẤY GRADE
  useEffect(() => {
    if (router.isReady && router.query.grade) setSelectedGrade(parseInt(router.query.grade));
  }, [router.isReady, router.query.grade]);

  // 3. FETCH DATA
  useEffect(() => {
      if (!selectedGrade) return;
      setLoading(true);
      const fetchQuizzes = async () => {
          try {
              const q = query(collection(firestore, "quizzes"), where("status", "==", "OPEN"), where("isPublic", "==", true));
              const querySnapshot = await getDocs(q);
              const grouped = {};
              querySnapshot.forEach(doc => {
                  const data = doc.data();
                  if (data.grade == selectedGrade) {
                      const subj = data.subject || "Thử Thách Khác";
                      if (!grouped[subj]) grouped[subj] = [];
                      grouped[subj].push({ id: doc.id, ...data });
                  }
              });
              setSubjectsData(grouped);
          } catch (e) { console.error(e); } finally { setLoading(false); }
      };
      fetchQuizzes();
      const lbQuery = query(collection(firestore, "student_profiles"), where("grade", "==", selectedGrade.toString()), orderBy("totalScore", "desc"), limit(10));
      const unsubscribeLB = onSnapshot(lbQuery, (snapshot) => setLeaderboard(snapshot.docs.map(d => d.data())), (e) => console.warn(e));
      return () => unsubscribeLB();
  }, [selectedGrade]);

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // --- LOGIC AUTHENTICATION ---

  const handleRegister = async (e) => {
      e.preventDefault();
      const { fullName, phone, password, confirmPassword } = formData;
      if (!fullName || !phone || !password) return alert("Điền đầy đủ thông tin!");
      if (password !== confirmPassword) return alert("Mật khẩu không khớp!");
      if (password.length < 6) return alert("Mật khẩu tối thiểu 6 ký tự!");
      if (!/^\d{9,11}$/.test(phone)) return alert("SĐT không hợp lệ!");

      setAuthLoading(true);
      try {
          const fakeEmail = createFakeEmail(phone);
          const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
          await updateProfile(userCredential.user, { displayName: fullName });
          await setDoc(doc(firestore, "student_profiles", userCredential.user.uid), {
              uid: userCredential.user.uid,
              email: fakeEmail, phone, fullName, nickname: fullName,
              photoURL: `https://ui-avatars.com/api/?name=${fullName}&background=random`,
              grade: selectedGrade ? selectedGrade.toString() : "10",
              totalScore: 0, role: 'STUDENT', createdAt: serverTimestamp()
          });
          alert("Đăng ký thành công!");
          setAuthMode(null);
      } catch (error) { alert(error.message); } finally { setAuthLoading(false); }
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      try {
          await signInWithEmailAndPassword(auth, createFakeEmail(formData.phone), formData.password);
          setAuthMode(null);
      } catch (error) { alert("Sai thông tin đăng nhập!"); } finally { setAuthLoading(false); }
  };

  // --- [UPDATE] LOGIC QUÊN MẬT KHẨU MỚI ---
  
  // Bước 1: Kiểm tra SĐT
  const handleCheckPhone = async (e) => {
      e.preventDefault();
      const { phone } = formData;
      if (!phone) return alert("Vui lòng nhập số điện thoại!");
      
      setAuthLoading(true);
      try {
          // Tìm trong collection student_profiles xem có SĐT này không
          const q = query(collection(firestore, "student_profiles"), where("phone", "==", phone));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
              // Tìm thấy -> Chuyển sang bước 2
              setResetStep(2);
          } else {
              alert("Số điện thoại này chưa được đăng ký trong hệ thống!");
          }
      } catch (e) {
          alert("Lỗi kiểm tra: " + e.message);
      } finally {
          setAuthLoading(false);
      }
  };

  // Bước 2: Thực hiện Reset (Gọi API)
  const handleResetPassword = async (e) => {
      e.preventDefault();
      const { phone, password, confirmPassword } = formData;
      
      if (password !== confirmPassword) return alert("Mật khẩu nhập lại không khớp!");
      if (password.length < 6) return alert("Mật khẩu phải có ít nhất 6 ký tự!");

      setAuthLoading(true);
      try {
          // GỌI API ROUTE ĐỂ RESET PASS (Cần tạo file API này)
          const response = await fetch('/api/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone, newPassword: password })
          });

          const data = await response.json();
          if (response.ok) {
              alert("✅ Đổi mật khẩu thành công! Hãy đăng nhập lại.");
              setResetStep(1);
              setAuthMode('LOGIN');
              setFormData({ ...formData, password: '', confirmPassword: '' });
          } else {
              throw new Error(data.message || "Lỗi reset mật khẩu");
          }
      } catch (e) {
          alert("Thất bại: " + e.message);
          console.error(e);
      } finally {
          setAuthLoading(false);
      }
  };

  const handleLogout = async () => { if(confirm("Đăng xuất?")) await signOut(auth); };
  
  const handleQuizClick = (quiz) => {
      if (!user) { setAuthMode('LOGIN'); return; }
      setSelectedQuiz(quiz); 
  };

  const startGame = (mode) => {
      if(!selectedQuiz) return;
      router.push(`/arcade/${selectedQuiz.id}?game=${mode}`);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative overflow-hidden flex flex-col">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-900/30 via-black to-black -z-20"></div>
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-red-600/30">
          <div className="container mx-auto px-4 h-16 flex justify-between items-center">
              <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-400 hover:text-white transition"><ChevronLeft size={20}/><span className="hidden md:block font-bold text-xs uppercase tracking-widest">QUAY LẠI</span></button>
              <div className="text-center"><h1 className="text-xl md:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600">CHIẾN BINH LUYỆN TẬP</h1>{selectedGrade && <div className="text-[10px] font-black text-red-500 uppercase tracking-[0.5em] animate-pulse">CLASS {selectedGrade}</div>}</div>
              <div>{user ? (<div className="flex items-center gap-2">{studentProfile && (<div className="flex items-center gap-3 bg-red-950/40 border border-red-500/30 pl-4 pr-1 py-1 rounded-full cursor-pointer hover:bg-red-900/50 transition group" onClick={handleLogout}><div className="text-right hidden md:block"><div className="text-xs font-black text-orange-400 uppercase">{studentProfile.nickname}</div><div className="text-[9px] text-slate-400 font-mono group-hover:text-yellow-400 transition-colors">{studentProfile.totalScore || 0} XP</div></div><img src={studentProfile.photoURL || user.photoURL} className="w-9 h-9 rounded-full border-2 border-orange-500 object-cover"/></div>)}</div>) : (<div className="flex gap-2"><button onClick={() => setAuthMode('LOGIN')} className="hidden md:flex text-xs font-bold text-slate-300 hover:text-white px-3 py-2 uppercase transition">Đăng nhập</button><button onClick={() => setAuthMode('REGISTER')} className="flex items-center gap-2 text-xs font-bold bg-white text-black hover:bg-slate-200 px-4 py-2 rounded-lg uppercase shadow-lg transition"><UserPlus size={16}/> <span className="hidden md:inline">Đăng Ký</span></button></div>)}</div>
          </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 container mx-auto px-2 md:px-4 py-6 overflow-y-auto custom-scrollbar">
          {loading ? ( <div className="flex justify-center py-20"><Flame className="animate-bounce text-red-500" size={48}/></div> ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                {/* LEFT */}
                <div className="lg:col-span-3 space-y-8 pb-20">
                    {Object.keys(subjectsData).length === 0 ? ( <div className="text-center py-20 border border-white/5 rounded-2xl bg-white/5"><Swords size={48} className="mx-auto text-slate-600 mb-4"/><p className="text-slate-500 italic">Chưa có nhiệm vụ nào.</p></div> ) : (
                        Object.entries(subjectsData).map(([subject, quizzes]) => (
                            <div key={subject} className="animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-2 mb-4 border-l-4 border-red-600 pl-3"><h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{subject}</h2><span className="bg-[#222] text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">{quizzes.length} ĐỀ</span></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {quizzes.map((quiz) => (<div key={quiz.id} onClick={() => handleQuizClick(quiz)} className="group relative bg-[#0a0a0a] border border-white/10 hover:border-red-500/50 p-0 rounded-xl cursor-pointer transition-all hover:bg-[#111] shadow-lg active:scale-[0.99] overflow-hidden flex"><div className="w-16 bg-white/5 flex items-center justify-center border-r border-white/5 group-hover:bg-red-900/20 transition-colors"><div className="w-10 h-10 rounded-full border-2 border-white/10 flex items-center justify-center group-hover:border-red-500 group-hover:text-red-500 transition-all"><PlayCircle size={20} fill="currentColor" className="opacity-50 group-hover:opacity-100"/></div></div><div className="flex-1 p-4 flex flex-col justify-center"><h3 className="font-bold text-slate-200 group-hover:text-white text-lg leading-tight mb-2 line-clamp-1">{quiz.title}</h3><div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider"><span className="text-orange-500 flex items-center gap-1"><Shield size={10}/> {quiz.questions?.length || 0} CÂU</span><span className="text-green-500">OPEN</span></div></div><div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#222] border border-white/10 shadow-inner flex items-center justify-center group-hover:border-red-500/50"><div className="w-3 h-3 rounded-full bg-slate-600 group-hover:bg-red-500 group-hover:shadow-[0_0_10px_#ef4444] transition-all"></div></div></div>))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {/* RIGHT - BXH */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 bg-[#0a0a0a] border border-yellow-600/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.05)]">
                        <div className="bg-gradient-to-b from-yellow-900/30 to-transparent p-6 text-center border-b border-yellow-600/20"><Crown size={32} className="mx-auto text-yellow-400 mb-2 animate-bounce drop-shadow-[0_0_10px_#facc15]"/><h3 className="text-2xl font-black text-yellow-400 uppercase italic tracking-widest">BẢNG VÀNG</h3><p className="text-[9px] text-yellow-200/50 uppercase font-bold tracking-[0.3em] mt-1">TOP CHIẾN BINH</p></div>
                        <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar p-0">
                             {leaderboard.length > 0 ? ( leaderboard.map((u, idx) => ( <div key={idx} className={`flex items-center gap-3 p-4 hover:bg-white/5 transition-colors group relative ${u.uid === user?.uid ? 'bg-yellow-900/20' : ''}`}><div className={`w-8 h-8 shrink-0 flex items-center justify-center font-black italic text-sm rounded-lg border shadow-lg z-10 ${idx===0 ? 'bg-yellow-400 text-black border-yellow-200' : idx===1 ? 'bg-slate-300 text-black border-white' : idx===2 ? 'bg-orange-600 text-white border-orange-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{idx + 1}</div><div className="flex-1 min-w-0 z-10"><div className={`font-bold text-sm truncate group-hover:text-yellow-400 transition-colors ${u.uid === user?.uid ? 'text-yellow-400' : 'text-white'}`}>{u.nickname}</div><div className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Star size={8} className="text-yellow-500" fill="currentColor"/> {u.totalScore?.toLocaleString() || 0} XP</div></div></div> )) ) : ( <div className="text-center py-12 px-4"><div className="text-4xl grayscale opacity-30 mb-2">🏆</div><p className="text-xs text-slate-500 italic">Chưa có ai ghi danh.</p></div> )}
                        </div>
                    </div>
                </div>
            </div>
          )}
      </main>

      {/* --- MODAL CHỌN GAME --- */}
      {selectedQuiz && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-200">
            <div className="relative bg-[#111] border border-red-600/40 p-6 md:p-8 rounded-[2rem] w-full max-w-3xl shadow-[0_0_60px_rgba(220,38,38,0.2)] overflow-hidden">
                <button onClick={() => setSelectedQuiz(null)} className="absolute top-4 right-4 bg-white/5 hover:bg-red-600 p-2 rounded-full transition text-slate-400 hover:text-white z-20"><X size={24}/></button>
                <div className="text-center mb-8 relative z-10"><h3 className="text-xl md:text-3xl font-black text-white uppercase italic tracking-tighter mb-2 line-clamp-1">{selectedQuiz.title}</h3><div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-red-900/30 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest"><Gamepad2 size={14}/> Chọn chế độ chơi</div></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 relative z-10">
                     <GameModeBtn title="Triệu Phú" desc="Leo thang thưởng" color="from-blue-700 to-indigo-900" icon={<DollarSign size={28}/>} onClick={() => startGame('MILLIONAIRE')} />
                     <GameModeBtn title="Vòng Quay" desc="Thử vận may" color="from-pink-600 to-rose-800" icon={<CircleDashed size={28}/>} onClick={() => startGame('WHEEL')} />
                     <GameModeBtn title="Lật Ô Chữ" desc="Ghi nhớ tốt" color="from-emerald-600 to-teal-800" icon={<LayoutGrid size={28}/>} onClick={() => startGame('FLIP')} />
                     <GameModeBtn title="Tìm Cặp" desc="Nối cặp đúng" color="from-orange-500 to-amber-700" icon={<Grid3X3 size={28}/>} onClick={() => startGame('MATCH')} />
                     <GameModeBtn title="Hộp Bí Mật" desc="Quà bất ngờ" color="from-purple-600 to-violet-900" icon={<Gift size={28}/>} onClick={() => startGame('BOX')} fullWidth />
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL LOGIN / REGISTER / FORGOT [UPDATE] --- */}
      {authMode && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in zoom-in duration-300">
           <div className="bg-[#1e1e24] border-2 border-orange-500 p-8 rounded-3xl w-full max-w-sm shadow-[0_0_50px_#f97316] relative">
              <button onClick={() => { setAuthMode(null); setResetStep(1); }} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
              
              {/* LOGIN */}
              {authMode === 'LOGIN' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div className="text-center mb-6"><LogIn size={48} className="mx-auto text-orange-500 mb-2"/><h3 className="text-2xl font-black text-white uppercase">ĐĂNG NHẬP</h3></div>
                      <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Phone size={18} className="text-slate-500"/><input name="phone" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Số điện thoại" type="tel"/></div>
                      <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="password" type={showPassword ? "text" : "password"} onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Mật khẩu"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-white">{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
                      <button disabled={authLoading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition">{authLoading ? 'Đang xử lý...' : 'VÀO NGAY'}</button>
                      <div className="flex justify-between text-xs font-bold mt-4"><button type="button" onClick={() => setAuthMode('FORGOT')} className="text-slate-500 hover:text-orange-400">Quên mật khẩu?</button><button type="button" onClick={() => setAuthMode('REGISTER')} className="text-orange-500 hover:text-white">Tạo tài khoản mới</button></div>
                  </form>
              )}

              {/* REGISTER */}
              {authMode === 'REGISTER' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                      <div className="text-center mb-6"><UserPlus size={48} className="mx-auto text-orange-500 mb-2"/><h3 className="text-2xl font-black text-white uppercase">ĐĂNG KÝ MỚI</h3></div>
                      <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><User size={18} className="text-slate-500"/><input name="fullName" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Họ và tên học sinh"/></div>
                      <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Phone size={18} className="text-slate-500"/><input name="phone" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Số điện thoại" type="tel"/></div>
                      <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="password" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Mật khẩu (min 6 số)"/></div>
                      <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="confirmPassword" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Nhập lại mật khẩu"/></div>
                      <button disabled={authLoading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition">{authLoading ? 'Đang tạo...' : 'XÁC NHẬN ĐĂNG KÝ'}</button>
                      <div className="text-center text-xs font-bold mt-4"><span className="text-slate-500">Đã có tài khoản? </span><button type="button" onClick={() => setAuthMode('LOGIN')} className="text-orange-500 hover:text-white">Đăng nhập</button></div>
                  </form>
              )}

              {/* FORGOT PASSWORD [UPDATE] */}
              {authMode === 'FORGOT' && (
                  <div className="space-y-4">
                      <div className="text-center mb-6">
                          <KeyRound size={48} className="mx-auto text-yellow-500 mb-2"/>
                          <h3 className="text-2xl font-black text-white uppercase">KHÔI PHỤC</h3>
                          <p className="text-xs text-slate-400">{resetStep === 1 ? 'Nhập SĐT để tìm tài khoản' : 'Thiết lập mật khẩu mới'}</p>
                      </div>
                      
                      {resetStep === 1 ? (
                          <form onSubmit={handleCheckPhone} className="space-y-4">
                              <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3">
                                  <Phone size={18} className="text-slate-500"/>
                                  <input name="phone" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Số điện thoại đã đăng ký" type="tel"/>
                              </div>
                              <button disabled={authLoading} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold uppercase transition flex items-center justify-center gap-2">
                                  {authLoading ? 'Đang kiểm tra...' : 'TIẾP TỤC'}
                              </button>
                          </form>
                      ) : (
                          <form onSubmit={handleResetPassword} className="space-y-4 animate-in slide-in-from-right">
                              <div className="bg-green-900/30 p-3 rounded-lg border border-green-500/30 text-green-400 text-xs font-bold text-center flex items-center justify-center gap-2">
                                  <Check size={14}/> Tài khoản hợp lệ: {formData.phone}
                              </div>
                              <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3">
                                  <Lock size={18} className="text-slate-500"/>
                                  <input name="password" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Mật khẩu mới"/>
                              </div>
                              <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3">
                                  <Lock size={18} className="text-slate-500"/>
                                  <input name="confirmPassword" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Nhập lại mật khẩu mới"/>
                              </div>
                              <button disabled={authLoading} className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition">
                                  {authLoading ? 'Đang cập nhật...' : 'ĐỔI MẬT KHẨU'}
                              </button>
                          </form>
                      )}
                      
                      <div className="text-center text-xs font-bold mt-4">
                          <button type="button" onClick={() => { setAuthMode('LOGIN'); setResetStep(1); }} className="text-orange-500 hover:text-white">Quay lại đăng nhập</button>
                      </div>
                  </div>
              )}

           </div>
        </div>
      )}
    </div>
  );
}

const GameModeBtn = ({ title, desc, color, icon, onClick, fullWidth }) => (
    <button onClick={onClick} className={`group relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br ${color} hover:scale-105 transition-all duration-300 shadow-xl border border-white/10 flex flex-col items-center justify-center text-center ${fullWidth ? 'col-span-2 md:col-span-4 flex-row gap-4' : ''}`}>
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"></div>
        <div className="bg-black/20 p-3 rounded-full mb-2 shadow-inner group-hover:rotate-12 transition-transform duration-500 text-white">{icon}</div>
        <div className={fullWidth ? 'text-left' : ''}>
            <div className="font-black text-white uppercase text-sm md:text-base leading-none mb-1 group-hover:text-yellow-300 transition-colors">{title}</div>
            <div className="text-[10px] text-white/70 uppercase font-bold tracking-wider">{desc}</div>
        </div>
    </button>
);