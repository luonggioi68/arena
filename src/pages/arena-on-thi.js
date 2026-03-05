import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '@/store/useAuthStore';
import { auth, firestore, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
    ArrowLeft, Loader2, Shield, Trophy, Medal, BookOpen, Clock, 
    CheckCircle, Target, Sparkles, AlertCircle, LogIn, User, Play, 
    CalendarDays, ChevronDown, ChevronUp, Search, X, FileText,
    Phone, Lock, Eye, EyeOff, UserPlus, KeyRound, Check 
} from 'lucide-react';

const GRADES = ['12', '11', '10', '9', '8', '7', '6', 'Khác'];

// Hàm "đánh lừa" Firebase Auth để dùng SĐT như Email
const createFakeEmail = (phone) => `${phone}@eduarena.vn`;

export default function ArenaOnThi() {
    const router = useRouter();
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(true);

    const [exams, setExams] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [activeGrade, setActiveGrade] = useState('12');
    const [searchTeacher, setSearchTeacher] = useState('');

    // ================= STATE AUTH TỪ TRANG TRAINING =================
    const [authMode, setAuthMode] = useState(null); 
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [resetStep, setResetStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: '', phone: '', password: '', confirmPassword: ''
    });

    useEffect(() => {
        // 1. Lắng nghe trạng thái auth
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        // 2. Tải dữ liệu Đề thi và Bảng xếp hạng TRỰC TIẾP
        const fetchData = async () => {
            try {
                // Tải toàn bộ Đề thi
                const qExams = query(collection(firestore, "pdf_exams"), where("status", "==", "OPEN"));
                const snapExams = await getDocs(qExams);
                const examsData = snapExams.docs.map(d => ({ id: d.id, ...d.data() }));
                examsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setExams(examsData);

                // Tải & Tính toán Bảng Xếp Hạng
                const snapResults = await getDocs(collection(firestore, "pdf_exam_results"));
                const scoresMap = {};
                
                snapResults.forEach(doc => {
                    const data = doc.data();
                    const sName = data.studentName;
                    const sScore = parseFloat(data.score) || 0;
                    const sGrade = data.studentClass || 'Tự do'; 
                    
                    if (!sName || sName.includes('ẩn danh') || sName.trim() === '') return;

                    if (!scoresMap[sName]) {
                        scoresMap[sName] = { 
                            name: sName, 
                            totalScore: 0, 
                            examsCount: 0, 
                            lastGrade: sGrade 
                        };
                    }
                    scoresMap[sName].totalScore += sScore;
                    scoresMap[sName].examsCount += 1;
                    scoresMap[sName].lastGrade = sGrade; 
                });

                const lbArray = Object.values(scoresMap)
                    .sort((a, b) => {
                        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                        return b.examsCount - a.examsCount;
                    });
                
                setLeaderboard(lbArray);
            } catch (e) {
                console.error("Lỗi tải dữ liệu:", e);
                if (e.code === 'permission-denied') {
                    alert("⚠️ LỖI PHÂN QUYỀN: Bạn chưa mở khóa Firestore Rules cho phép khách đọc dữ liệu. Vui lòng kiểm tra Firebase!");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => unsubscribe();
    }, [setUser]);

    const examsBySubject = useMemo(() => {
        const filtered = exams.filter(e => {
            const matchGrade = e.grade === activeGrade;
            const authorStr = (e.authorName || e.authorEmail || 'Arena GV').toLowerCase();
            return matchGrade && (searchTeacher.trim() === '' || authorStr.includes(searchTeacher.toLowerCase().trim()));
        });
        return filtered.reduce((acc, exam) => {
            const subject = exam.subject || 'Khác';
            if (!acc[subject]) acc[subject] = [];
            acc[subject].push(exam);
            return acc;
        }, {});
    }, [exams, activeGrade, searchTeacher]);

    const formatDate = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('vi-VN') : '---';

    // ================= HANDLERS AUTH =================
    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

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
                grade: activeGrade ? activeGrade.toString() : "12",
                totalScore: 0, role: 'STUDENT', createdAt: serverTimestamp()
            });
            alert("Đăng ký thành công!");
            setAuthMode(null);
        } catch (error) { 
            if(error.code === 'auth/email-already-in-use') alert("Số điện thoại này đã được sử dụng!");
            else alert("Lỗi đăng ký: " + error.message); 
        } finally { setAuthLoading(false); }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        try {
            await signInWithEmailAndPassword(auth, createFakeEmail(formData.phone), formData.password);
            setAuthMode(null);
        } catch (error) { alert("Sai số điện thoại hoặc mật khẩu!"); } finally { setAuthLoading(false); }
    };

    const handleLoginGoogle = async () => {
        try { 
            await signInWithPopup(auth, googleProvider); 
            setAuthMode(null);
        } catch (e) { alert("Lỗi Google: " + e.message); }
    };

    const handleCheckPhone = async (e) => {
        e.preventDefault();
        const { phone } = formData;
        if (!phone) return alert("Vui lòng nhập số điện thoại!");
        setAuthLoading(true);
        try {
            const q = query(collection(firestore, "student_profiles"), where("phone", "==", phone));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) setResetStep(2);
            else alert("Số điện thoại này chưa được đăng ký!");
        } catch (e) { alert("Lỗi: " + e.message); } finally { setAuthLoading(false); }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const { phone, password, confirmPassword } = formData;
        if (password !== confirmPassword) return alert("Mật khẩu không khớp!");
        if (password.length < 6) return alert("Mật khẩu tối thiểu 6 ký tự!");
        setAuthLoading(true);
        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, newPassword: password })
            });
            const data = await response.json();
            if (response.ok) {
                alert("✅ Đổi mật khẩu thành công!");
                setResetStep(1); setAuthMode('LOGIN'); setFormData({ ...formData, password: '', confirmPassword: '' });
            } else { throw new Error(data.message); }
        } catch (e) { alert("Thất bại: " + e.message); } finally { setAuthLoading(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-cyan-500" size={60} /></div>;

    return (
        <div className="min-h-screen bg-[#09090b] text-slate-200 font-sans pb-20 overflow-x-hidden relative">
            
            {/* BACKGROUND CHUNG */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-[#09090b] to-black -z-20"></div>

            {/* ================= HEADER 3D NEON RỰC LỬA ================= */}
            <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b-2 border-orange-600 shadow-[0_10px_30px_rgba(249,115,22,0.15)] px-2 sm:px-4 h-[70px] sm:h-[80px]">
                {/* Tia sáng hắt từ trên xuống */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none"></div>

                <div className="max-w-[1600px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-4 relative z-10">
                    
                    {/* CỤM TRÁI: Nút Back 3D & Logo */}
                    <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => router.push('/')} className="relative group p-2.5 sm:p-3 bg-gradient-to-b from-orange-500 to-red-600 border-b-4 border-red-900 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.5)] active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-500"></div>
                            <ArrowLeft size={20} className="text-white drop-shadow-md relative z-10" strokeWidth={3} />
                        </button>
                        
                        <div className="hidden lg:flex items-center gap-2 font-black italic uppercase text-2xl tracking-tighter drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]">
                            <Shield className="text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,1)]" size={32} />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600">ARENA ÔN THI</span>
                        </div>
                    </div>

                    {/* CỤM GIỮA: Thanh tìm kiếm Neon Glow */}
                    <div className="flex-1 max-w-2xl relative group mx-1 sm:mx-4">
                        {/* Hào quang phát sáng khi focus */}
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 rounded-2xl blur opacity-30 group-focus-within:opacity-80 transition duration-500"></div>
                        <div className="relative flex items-center bg-[#0a0a0a] border-2 border-orange-600/50 rounded-2xl h-10 sm:h-[50px] overflow-hidden shadow-inner">
                            <Search className="ml-3 sm:ml-4 text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" size={20} />
                            <input 
                                type="text"
                                placeholder="Tìm nhiệm vụ theo tên giáo viên..."
                                value={searchTeacher}
                                onChange={(e) => setSearchTeacher(e.target.value)}
                                className="w-full bg-transparent border-none text-white text-xs sm:text-sm font-bold px-2 sm:px-4 h-full outline-none placeholder:text-orange-900/70"
                            />
                            {searchTeacher && (
                                <button onClick={() => setSearchTeacher('')} className="mr-2 sm:mr-3 text-orange-500 hover:text-white p-1 transition-colors">
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* CỤM PHẢI: User Badge hoặc Nút Đăng nhập 3D */}
                    <div className="shrink-0">
                        {user ? (
                            <div 
                                onClick={async () => { if(confirm("Bạn muốn đăng xuất?")) await signOut(auth); }} 
                                className="cursor-pointer flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-red-950 to-[#0a0a0a] border-2 border-orange-600/50 pl-2 sm:pl-4 pr-1 sm:pr-1.5 py-1 sm:py-1.5 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:scale-105 transition-transform"
                                title="Nhấn để đăng xuất"
                            >
                                <span className="text-[10px] sm:text-xs font-black text-yellow-100 hidden sm:block truncate max-w-[100px] lg:max-w-[150px] drop-shadow-md tracking-wider">
                                    {user.displayName || user.email}
                                </span>
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 flex items-center justify-center border-2 border-yellow-200 text-black shadow-[0_0_15px_rgba(250,204,21,0.6)] shrink-0">
                                    <User size={16} strokeWidth={2.5}/>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setAuthMode('LOGIN')} className="relative px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-b from-yellow-400 via-orange-500 to-red-600 border-b-4 border-red-900 rounded-xl text-[10px] sm:text-xs font-black text-white uppercase tracking-widest active:translate-y-1 active:border-b-0 transition-all shadow-[0_0_20px_rgba(249,115,22,0.5)] overflow-hidden group">
                                <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-500"></div>
                                <span className="relative z-10 flex items-center gap-1.5 drop-shadow-md">
                                    <LogIn size={14} className="hidden sm:block" strokeWidth={3}/> Đăng nhập
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </header>
            {/* ================= END HEADER ================= */}

            <main className="max-w-[1600px] mx-auto px-4 mt-8 flex flex-col xl:flex-row gap-8">
                {/* CỘT TRÁI: DANH SÁCH ĐỀ */}
                <div className="flex-1 overflow-hidden">
                    <div className="flex overflow-x-auto no-scrollbar gap-2 mb-8 pb-1">
                        {GRADES.map(grade => (
                            <button 
                                key={grade} onClick={() => setActiveGrade(grade)}
                                className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition-all border-2 ${
                                    activeGrade === grade 
                                    ? 'bg-gradient-to-br from-cyan-600 to-blue-700 border-cyan-400 text-white shadow-lg scale-105' 
                                    : 'bg-[#18181b] border-slate-800 text-slate-400 hover:border-cyan-500/50'
                                }`}
                            >
                                LỚP {grade}
                            </button>
                        ))}
                    </div>

                    {Object.keys(examsBySubject).length === 0 ? (
                        <div className="bg-[#18181b] border border-slate-800 rounded-[2rem] p-20 text-center flex flex-col items-center">
                            <BookOpen size={48} className="text-slate-700 mb-4"/>
                            <p className="text-slate-500 font-bold">Không tìm thấy dữ liệu phù hợp</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {Object.entries(examsBySubject).map(([subject, subExams]) => (
                                <div key={subject}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <h2 className="text-2xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">{subject}</h2>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </div>

                                    <div className="bg-[#18181b] rounded-2xl sm:rounded-3xl border border-slate-800 overflow-x-auto custom-scrollbar shadow-2xl relative">
                                        <table className="w-full text-left min-w-[600px] lg:min-w-full border-collapse">
                                            <thead className="bg-slate-900 text-[10px] font-black text-cyan-400 uppercase tracking-widest border-b border-slate-800">
                                                <tr>
                                                    <th className="p-3 sm:p-4 w-10 sm:w-12 text-center shrink-0">TT</th>
                                                    <th className="p-3 sm:p-4 min-w-[180px]">Tên Đề / Mã</th>
                                                    <th className="p-3 sm:p-4 text-center shrink-0">Ngày tạo</th>
                                                    <th className="p-3 sm:p-4 text-center shrink-0">Số câu</th>
                                                    <th className="p-3 sm:p-4 text-center shrink-0">Thời gian</th>
                                                    
                                                    {/* THAO TÁC (Được ghim dính ở mép phải) */}
                                                    <th className="p-3 sm:p-4 text-center w-24 sm:w-32 shrink-0 sticky right-0 bg-slate-900 shadow-[-8px_0_15px_-5px_rgba(0,0,0,0.5)] z-20 border-l border-slate-800">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {subExams.map((exam, idx) => (
                                                    <tr key={exam.id} className="bg-[#18181b] hover:bg-slate-800 transition-colors group">
                                                        <td className="p-3 sm:p-4 text-center font-mono text-slate-500">{idx + 1}</td>
                                                        <td className="p-3 sm:p-4">
                                                            {/* Bổ sung click vào tiêu đề để vào thi */}
                                                            <div 
                                                                onClick={() => router.push(`/pdf-play/${exam.code}`)}
                                                                className="font-bold text-white group-hover:text-cyan-400 transition-colors cursor-pointer"
                                                                title="Nhấn để vào thi"
                                                            >
                                                                {exam.title}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-mono mt-1">ID: {exam.code} | GV: {exam.authorName || 'Arena'}</div>
                                                        </td>
                                                        <td className="p-3 sm:p-4 text-center text-xs text-slate-400 font-mono">{formatDate(exam.createdAt)}</td>
                                                        <td className="p-3 sm:p-4 text-center">
                                                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-xs font-black">{exam.totalQuestions}</span>
                                                        </td>
                                                        <td className="p-3 sm:p-4 text-center">
                                                            <span className="text-orange-400 font-black text-sm">{exam.timeLimit}p</span>
                                                        </td>
                                                        
                                                        {/* NÚT VÀO THI (Được ghim dính ở mép phải) */}
                                                        <td className="p-2 sm:p-4 text-center sticky right-0 bg-inherit shadow-[-8px_0_15px_-5px_rgba(0,0,0,0.5)] z-10 border-l border-slate-800/50">
                                                            <button onClick={() => router.push(`/pdf-play/${exam.code}`)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95">VÀO THI</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* CỘT PHẢI: BẢNG VÀNG THIẾT KẾ ĐẦY ĐỦ */}
                <div className="w-full xl:w-[350px] shrink-0">
                    <div className="sticky top-[100px] bg-[#18181b] border-2 border-orange-500/20 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 flex items-center gap-3">
                            <Trophy className="text-white" size={32} />
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase italic leading-none">Bảng Vàng</h2>
                                <p className="text-[10px] text-orange-100 font-bold uppercase tracking-widest mt-1 opacity-80">Tích lũy XP hệ thống</p>
                            </div>
                        </div>

                        <div className="p-2 max-h-[600px] overflow-y-auto custom-scrollbar bg-slate-950/50">
                            {leaderboard.length === 0 ? (
                                <div className="p-10 text-center text-slate-600 font-bold text-xs uppercase">Chưa có dữ liệu</div>
                            ) : (
                                <table className="w-full border-separate border-spacing-y-2">
                                    <thead className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                        <tr>
                                            <th className="pb-2 pl-4 text-left">Top</th>
                                            <th className="pb-2 text-left">Học sinh / Lớp</th>
                                            <th className="pb-2 pr-4 text-right">Tổng Điểm</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((student, index) => {
                                            const isTop3 = index < 3;
                                            const colors = [
                                                "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]",
                                                "bg-slate-300 text-black shadow-[0_0_15px_rgba(203,213,225,0.3)]",
                                                "bg-orange-700 text-white shadow-[0_0_15px_rgba(194,65,12,0.3)]"
                                            ];

                                            return (
                                                <tr key={student.name} className="bg-slate-900/50 hover:bg-slate-800 transition-colors group">
                                                    <td className="py-3 pl-4 rounded-l-2xl">
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-2 ${isTop3 ? colors[index] : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                                                            {isTop3 ? <Medal size={14}/> : index + 1}
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="font-bold text-sm text-white truncate max-w-[120px] group-hover:text-cyan-400 transition-colors">{student.name}</div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 font-bold">Lớp {student.lastGrade}</span>
                                                            <span className="text-[9px] text-slate-500 italic">Đã giải {student.examsCount} đề</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4 text-right rounded-r-2xl">
                                                        <div className="text-orange-400 font-black text-lg drop-shadow-md">
                                                            {student.totalScore.toFixed(2)}
                                                            <span className="text-[10px] ml-0.5 opacity-60">đ</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* MODAL AUTH TỪ TRANG TRAINING */}
            {authMode && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in zoom-in duration-300">
                <div className="bg-[#1e1e24] border-2 border-orange-500 p-8 rounded-3xl w-full max-w-sm shadow-[0_0_50px_#f97316] relative">
                    <button onClick={() => { setAuthMode(null); setResetStep(1); }} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                    
                    {/* LOGIN */}
                    {authMode === 'LOGIN' && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="text-center mb-6"><LogIn size={48} className="mx-auto text-orange-500 mb-2"/><h4 className="text-2xl font-black text-white uppercase">ĐĂNG NHẬP DÀNH CHO HỌC SINH</h4></div>
                            <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Phone size={18} className="text-slate-500"/><input name="phone" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Số điện thoại" type="tel"/></div>
                            <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="password" type={showPassword ? "text" : "password"} onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Mật khẩu"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-white">{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
                            
                            <button disabled={authLoading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition">{authLoading ? 'Đang xử lý...' : 'VÀO NGAY'}</button>
                            
                            <div className="relative my-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-[#1e1e24] px-2 text-slate-500 font-bold">Hoặc</span></div></div>
                            
                            {/* NÚT GOOGLE */}
                            <button type="button" onClick={handleLoginGoogle} className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase shadow-lg hover:bg-slate-200 transition flex items-center justify-center gap-2">
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5"/> Đăng nhập Google
                            </button>

                            <div className="flex justify-between text-xs font-bold mt-4"><button type="button" onClick={() => setAuthMode('FORGOT')} className="text-slate-500 hover:text-orange-400">Quên mật khẩu?</button><button type="button" onClick={() => setAuthMode('REGISTER')} className="text-orange-500 hover:text-white">Tạo tài khoản mới</button></div>
                        </form>
                    )}

                    {/* REGISTER */}
                    {authMode === 'REGISTER' && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="text-center mb-6"><UserPlus size={48} className="mx-auto text-orange-500 mb-2"/><h3 className="text-2xl font-black text-white uppercase">ĐĂNG KÝ MỚI DÀNH CHO HỌC SINH</h3></div>
                            <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><User size={18} className="text-slate-500"/><input name="fullName" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Họ và tên học sinh"/></div>
                            <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Phone size={18} className="text-slate-500"/><input name="phone" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Số điện thoại" type="tel"/></div>
                            <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="password" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Mật khẩu (min 6 số)"/></div>
                            <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="confirmPassword" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Nhập lại mật khẩu"/></div>
                            <button disabled={authLoading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition">{authLoading ? 'Đang tạo...' : 'XÁC NHẬN ĐĂNG KÝ'}</button>
                            <div className="text-center text-xs font-bold mt-4"><span className="text-slate-500">Đã có tài khoản? </span><button type="button" onClick={() => setAuthMode('LOGIN')} className="text-orange-500 hover:text-white">Đăng nhập</button></div>
                        </form>
                    )}

                    {/* FORGOT */}
                    {authMode === 'FORGOT' && (
                        <div className="space-y-4">
                            <div className="text-center mb-6"><KeyRound size={48} className="mx-auto text-yellow-500 mb-2"/><h3 className="text-2xl font-black text-white uppercase">KHÔI PHỤC</h3><p className="text-xs text-slate-400">{resetStep === 1 ? 'Nhập SĐT để tìm tài khoản' : 'Thiết lập mật khẩu mới'}</p></div>
                            {resetStep === 1 ? (
                                <form onSubmit={handleCheckPhone} className="space-y-4">
                                    <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Phone size={18} className="text-slate-500"/><input name="phone" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Số điện thoại đã đăng ký" type="tel"/></div>
                                    <button disabled={authLoading} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold uppercase transition flex items-center justify-center gap-2">{authLoading ? 'Đang kiểm tra...' : 'TIẾP TỤC'}</button>
                                </form>
                            ) : (
                                <form onSubmit={handleResetPassword} className="space-y-4 animate-in slide-in-from-right">
                                    <div className="bg-green-900/30 p-3 rounded-lg border border-green-500/30 text-green-400 text-xs font-bold text-center flex items-center justify-center gap-2"><Check size={14}/> Tài khoản hợp lệ: {formData.phone}</div>
                                    <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="password" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Mật khẩu mới"/></div>
                                    <div className="bg-black border border-orange-900/50 rounded-xl p-3 flex items-center gap-3"><Lock size={18} className="text-slate-500"/><input name="confirmPassword" type="password" onChange={handleInputChange} className="bg-transparent w-full text-white font-bold outline-none placeholder:text-slate-600" placeholder="Nhập lại mật khẩu mới"/></div>
                                    <button disabled={authLoading} className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition">{authLoading ? 'Đang cập nhật...' : 'ĐỔI MẬT KHẨU'}</button>
                                </form>
                            )}
                            <div className="text-center text-xs font-bold mt-4"><button type="button" onClick={() => { setAuthMode('LOGIN'); setResetStep(1); }} className="text-orange-500 hover:text-white">Quay lại đăng nhập</button></div>
                        </div>
                    )}
                </div>
                </div>
            )}

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ea580c; }
            `}</style>
        </div>
    );
}