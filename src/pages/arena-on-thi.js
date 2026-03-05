import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '@/store/useAuthStore';
import { auth, firestore, googleProvider } from '@/lib/firebase';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
    ArrowLeft, Loader2, Shield, Trophy, Medal, BookOpen, Clock, 
    CheckCircle, Target, AlertCircle, LogIn, User, Play, CalendarDays, 
    ChevronDown, ChevronUp, Search, X, Phone, Lock, Eye, EyeOff 
} from 'lucide-react';

const GRADES = ['12', '11', '10', '9', '8', '7', '6', 'Khác'];

// Hàm "đánh lừa" Firebase Auth để dùng SĐT như Email (Lấy từ training.js)
const createFakeEmail = (phone) => `${phone}@eduarena.vn`;

export default function ArenaOnThi() {
    const router = useRouter();
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(true);

    const [exams, setExams] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [activeGrade, setActiveGrade] = useState('12');
    
    // State cho ô tìm kiếm giáo viên và mở rộng môn học
    const [searchTeacher, setSearchTeacher] = useState('');
    const [expandedSubjects, setExpandedSubjects] = useState({});

    // ==========================================
    // STATES & LOGIC ĐĂNG NHẬP (TỪ TRAINING.JS)
    // ==========================================
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
    const [authData, setAuthData] = useState({ phone: '', password: '', name: '' });
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            setAuthLoading(true); setAuthError('');
            await signInWithPopup(auth, googleProvider);
            setShowAuthModal(false);
        } catch (error) {
            setAuthError('Lỗi đăng nhập Google: ' + error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handlePhoneAuth = async (e) => {
        e.preventDefault();
        setAuthError(''); setAuthLoading(true);
        const { phone, password, name } = authData;

        if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(phone)) {
            setAuthError('Số điện thoại không hợp lệ!');
            setAuthLoading(false); return;
        }
        if (password.length < 6) {
            setAuthError('Mật khẩu phải từ 6 ký tự!');
            setAuthLoading(false); return;
        }

        const fakeEmail = createFakeEmail(phone);

        try {
            if (authMode === 'register') {
                if (!name.trim()) throw new Error("Vui lòng nhập họ tên!");
                const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
                await updateProfile(userCredential.user, { displayName: name });
                setUser({ ...userCredential.user, displayName: name });
            } else {
                await signInWithEmailAndPassword(auth, fakeEmail, password);
            }
            setShowAuthModal(false);
            setAuthData({ phone: '', password: '', name: '' });
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') setAuthError('Số điện thoại này đã được đăng ký!');
            else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') setAuthError('Sai số điện thoại hoặc mật khẩu!');
            else setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    // ==========================================
    // TẢI DỮ LIỆU & XÁC THỰC
    // ==========================================
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            try {
                // 1. Tải toàn bộ Đề thi đang MỞ
                const qExams = query(collection(firestore, "pdf_exams"), where("status", "==", "OPEN"));
                const snapExams = await getDocs(qExams);
                const examsData = snapExams.docs.map(d => ({ id: d.id, ...d.data() }));
                
                // Đảm bảo đề MỚI NHẤT luôn xếp lên đầu
                examsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setExams(examsData);

                // 2. Tải & Tính toán Bảng Xếp Hạng
                const snapResults = await getDocs(collection(firestore, "exam_results"));
                const scoresMap = {};
                
                snapResults.forEach(doc => {
                    const data = doc.data();
                    const sName = data.studentName;
                    const sScore = parseFloat(data.score) || 0;
                    
                    if (!sName || sName.includes('ẩn danh') || sName.includes('Khách_') || sName.trim() === '') return;

                    if (!scoresMap[sName]) {
                        scoresMap[sName] = { name: sName, totalScore: 0, examsCount: 0 };
                    }
                    scoresMap[sName].totalScore += sScore;
                    scoresMap[sName].examsCount += 1;
                });

                const lbArray = Object.values(scoresMap)
                    .sort((a, b) => b.totalScore - a.totalScore)
                    .slice(0, 10);
                
                setLeaderboard(lbArray);
            } catch (e) {
                console.error("Lỗi tải dữ liệu:", e);
            } finally {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [setUser]);

    // --- LỌC & NHÓM ĐỀ THEO MÔN & TÌM KIẾM GIÁO VIÊN ---
    const examsBySubject = useMemo(() => {
        const filtered = exams.filter(e => {
            const matchGrade = e.grade === activeGrade;
            const authorStr = (e.authorName || e.authorEmail || 'Arena GV').toLowerCase();
            const matchTeacher = searchTeacher.trim() === '' || authorStr.includes(searchTeacher.toLowerCase().trim());
            return matchGrade && matchTeacher;
        });

        return filtered.reduce((acc, exam) => {
            const subject = exam.subject || 'Khác';
            if (!acc[subject]) acc[subject] = [];
            acc[subject].push(exam);
            return acc;
        }, {});
    }, [exams, activeGrade, searchTeacher]);

    const toggleExpand = (subject) => {
        setExpandedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }));
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '---';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('vi-VN');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-cyan-500 drop-shadow-[0_0_15px_#06b6d4]" size={60} /></div>;

    return (
        <div className="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-20 overflow-x-hidden relative">
            {/* BACKGROUND NEON GLOW */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#09090b] to-black -z-20"></div>
            <div className="fixed top-1/4 left-0 w-96 h-96 bg-blue-600/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>
            <div className="fixed bottom-1/4 right-0 w-96 h-96 bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>

            {/* HEADER */}
            <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(6,182,212,0.15)]">
                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-[70px] flex items-center justify-between gap-4">
                    
                    <div className="flex items-center gap-3 md:gap-4 shrink-0">
                        <button onClick={() => router.push('/')} className="p-2 md:p-2.5 bg-slate-900 hover:bg-cyan-900/50 rounded-xl text-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-500/30 flex items-center gap-2 group">
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div className="h-6 w-px bg-cyan-500/20 hidden sm:block"></div>
                        <div className="flex items-center gap-2 font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-tighter text-lg md:text-2xl drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            <Shield className="text-cyan-400 hidden sm:block" size={24} /> 
                            <span className="hidden sm:inline">ARENA ÔN THI</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
                        <div className="relative group w-full max-w-[200px] md:max-w-[300px]">
                            <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
                                <Search size={16} className="text-slate-500 group-focus-within:text-cyan-400 transition-colors"/>
                            </div>
                            <input 
                                type="text"
                                placeholder="Tìm theo tên Giáo viên..."
                                value={searchTeacher}
                                onChange={(e) => setSearchTeacher(e.target.value)}
                                className="w-full bg-[#18181b]/80 backdrop-blur-md border border-slate-700 text-white text-xs md:text-sm font-bold rounded-full pl-9 md:pl-11 pr-4 py-2 md:py-2.5 focus:border-cyan-500 outline-none transition-all shadow-inner focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] placeholder:text-slate-500"
                            />
                        </div>

                        <div className="shrink-0">
                            {user ? (
                                <div className="bg-slate-900/80 border border-emerald-500/30 px-2 md:px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest text-right hidden lg:block">
                                        <span className="block leading-none">Chiến binh</span>
                                        <span className="text-sm text-white">{user.displayName || user.email}</span>
                                    </div>
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400" title={user.displayName || user.email}>
                                        <User size={16} className="text-emerald-400"/>
                                    </div>
                                </div>
                            ) : (
                                // NÚT ĐĂNG NHẬP MỞ BẢNG MODAL
                                <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400 text-white px-3 md:px-5 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                                    <LogIn size={16}/> <span className="hidden sm:inline">Đăng nhập</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1500px] mx-auto px-4 sm:px-6 mt-6 md:mt-8 flex flex-col xl:flex-row gap-8 relative z-10">
                
                {/* CỘT TRÁI */}
                <div className="w-full xl:w-[72%] overflow-hidden">
                    
                    {!user && (
                        <div className="mb-6 bg-orange-950/40 border border-orange-500/50 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                            <AlertCircle className="text-orange-400 shrink-0 mt-0.5 animate-pulse" size={24}/>
                            <div>
                                <h3 className="text-orange-400 font-black text-sm uppercase tracking-wider text-shadow-sm">Chế độ Khách Ẩn Danh</h3>
                                {/* NÚT MỞ BẢNG MODAL TRONG CẢNH BÁO */}
                                <p className="text-slate-300 text-xs md:text-sm mt-1">Bạn có thể thi thử, nhưng điểm số sẽ không được lưu. <button onClick={()=>setShowAuthModal(true)} className="text-cyan-400 underline font-black hover:text-cyan-300">Đăng nhập ngay</button> để ghi danh Bảng Vàng!</p>
                            </div>
                        </div>
                    )}

                    <div className="flex overflow-x-auto no-scrollbar gap-3 md:gap-4 mb-8 pb-4 snap-x">
                        {GRADES.map(grade => {
                            const isActive = activeGrade === grade;
                            return (
                                <button 
                                    key={grade} onClick={() => { setActiveGrade(grade); setExpandedSubjects({}); }}
                                    className={`shrink-0 snap-center px-6 py-3.5 rounded-[1.5rem] font-black text-sm transition-all duration-300 border-2 flex items-center gap-2 ${
                                        isActive 
                                        ? 'bg-gradient-to-br from-cyan-600 to-blue-700 border-cyan-400 text-white shadow-[0_10px_30px_rgba(6,182,212,0.4)] scale-105' 
                                        : 'bg-[#18181b] border-slate-800 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                    }`}
                                >
                                    {isActive && <Target size={16} className="animate-spin-slow"/>} LỚP {grade}
                                </button>
                            )
                        })}
                    </div>

                    {Object.keys(examsBySubject).length === 0 ? (
                        <div className="bg-[#18181b] border border-slate-800 rounded-[2rem] p-12 text-center flex flex-col items-center shadow-xl">
                            <div className="bg-slate-800/50 p-6 rounded-full mb-4 border border-slate-700 shadow-inner">
                                <BookOpen size={48} className="text-slate-600"/>
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Trống Trận Địa</h3>
                            <p className="text-slate-500 text-sm">
                                {searchTeacher ? `Không tìm thấy đề thi nào của giáo viên "${searchTeacher}" trong Khối ${activeGrade}.` : `Chưa có nhiệm vụ nào được ban hành cho Lớp ${activeGrade}.`}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-12 animate-in fade-in duration-700">
                            {Object.entries(examsBySubject).map(([subject, subExams]) => {
                                const isExpanded = expandedSubjects[subject];
                                const visibleExams = isExpanded ? subExams : subExams.slice(0, 5);
                                const hasMore = subExams.length > 5;

                                return (
                                    <div key={subject} className="relative">
                                        <div className="flex items-center gap-4 mb-4">
                                            <h2 className="text-2xl md:text-3xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 tracking-tighter drop-shadow-md">
                                                {subject}
                                            </h2>
                                            <span className="bg-purple-900/40 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-black shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                                {subExams.length} ĐỀ
                                            </span>
                                            <div className="h-px bg-gradient-to-r from-purple-500/50 to-transparent flex-1"></div>
                                        </div>

                                        <div className="bg-[#18181b] rounded-[1.5rem] border border-slate-800 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse min-w-[800px]">
                                                    <thead className="bg-slate-900/80 border-b border-slate-800">
                                                        <tr>
                                                            <th className="p-4 text-center text-xs font-black text-cyan-400 uppercase tracking-widest w-12">TT</th>
                                                            <th className="p-4 text-xs font-black text-cyan-400 uppercase tracking-widest">Tên Đề / Mã</th>
                                                            <th className="p-4 text-center text-xs font-black text-cyan-400 uppercase tracking-widest w-28">Ngày Tạo</th>
                                                            <th className="p-4 text-center text-xs font-black text-cyan-400 uppercase tracking-widest w-24">Số Câu</th>
                                                            <th className="p-4 text-center text-xs font-black text-cyan-400 uppercase tracking-widest w-24">Thời Gian</th>
                                                            <th className="p-4 text-xs font-black text-cyan-400 uppercase tracking-widest w-40">Giáo Viên</th>
                                                            <th className="p-4 text-center text-xs font-black text-cyan-400 uppercase tracking-widest w-32">Thao Tác</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/50">
                                                        {visibleExams.map((exam, index) => (
                                                            <tr key={exam.id} className="hover:bg-slate-800/40 transition-colors group">
                                                                <td className="p-4 text-center text-slate-500 font-mono font-bold text-sm">{index + 1}</td>
                                                                <td className="p-4">
                                                                    <div className="font-bold text-white text-base md:text-lg mb-1 group-hover:text-cyan-300 transition-colors line-clamp-2">{exam.title}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-mono text-cyan-500 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-900">Mã: {exam.code}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-center text-slate-400 text-xs font-mono">
                                                                    <div className="flex items-center justify-center gap-1.5 bg-slate-900 py-1.5 rounded-lg border border-slate-800">
                                                                        <CalendarDays size={12}/> {formatDate(exam.createdAt)}
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className="text-white font-black text-lg bg-slate-900 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-700 mx-auto shadow-inner">{exam.totalQuestions}</span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <div className="text-orange-400 font-black text-lg flex flex-col items-center leading-none">
                                                                        {exam.timeLimit} <span className="text-[9px] uppercase tracking-widest text-slate-500 mt-1">Phút</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg">
                                                                            {(exam.authorName || exam.authorEmail || 'G').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]" title={exam.authorName || exam.authorEmail}>
                                                                            {exam.authorName || exam.authorEmail || 'Arena GV'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <button 
                                                                        onClick={() => router.push(`/pdf-play/${exam.code}`)} 
                                                                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_4px_15px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border border-cyan-400/50 group-hover:animate-pulse"
                                                                    >
                                                                        <Play size={14} fill="currentColor"/> VÀO THI
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            
                                            {hasMore && (
                                                <div className="bg-slate-900/50 border-t border-slate-800 p-3 flex justify-center">
                                                    <button 
                                                        onClick={() => toggleExpand(subject)} 
                                                        className="flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-xs uppercase tracking-widest transition-colors bg-purple-900/20 hover:bg-purple-900/40 px-6 py-2 rounded-full border border-purple-500/30"
                                                    >
                                                        {isExpanded ? <><ChevronUp size={16}/> Thu gọn danh sách</> : <><ChevronDown size={16}/> Xem thêm {subExams.length - 5} đề nữa</>}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* CỘT PHẢI */}
                <div className="w-full xl:w-[28%] shrink-0">
                    <div className="sticky top-[100px] bg-[#18181b] p-6 rounded-[2rem] border-2 border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.15)] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-600/20 blur-[60px] rounded-full pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-8 relative z-10 border-b border-slate-800 pb-6">
                            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.5)] text-white"><Trophy size={28} /></div>
                            <div>
                                <h2 className="text-2xl font-black uppercase text-white tracking-tighter italic">Bảng Vàng</h2>
                                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">Tích lũy XP hệ thống</p>
                            </div>
                        </div>

                        {leaderboard.length === 0 ? (
                            <div className="text-center py-10 relative z-10 bg-[#09090b] rounded-2xl border border-slate-800">
                                <Target size={40} className="mx-auto text-slate-700 mb-3"/>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chưa có ai ghi danh</p>
                            </div>
                        ) : (
                            <div className="space-y-3 relative z-10">
                                {leaderboard.map((student, index) => {
                                    let badgeColor = "bg-[#09090b] text-slate-500 border-slate-800";
                                    let icon = null; let glow = "";
                                    
                                    if (index === 0) { badgeColor = "bg-yellow-500 text-black border-yellow-400"; glow = "shadow-[0_0_20px_rgba(234,179,8,0.3)] border-yellow-500/50"; icon = <Medal size={16}/>; } 
                                    else if (index === 1) { badgeColor = "bg-slate-300 text-black border-white"; glow = "shadow-[0_0_15px_rgba(255,255,255,0.2)] border-slate-400/50"; icon = <Medal size={14}/>; } 
                                    else if (index === 2) { badgeColor = "bg-orange-700 text-white border-orange-500"; glow = "shadow-[0_0_15px_rgba(249,115,22,0.2)] border-orange-700/50"; icon = <Medal size={12}/>; }

                                    return (
                                        <div key={student.name} className={`flex items-center justify-between bg-[#09090b] p-3.5 rounded-2xl border ${glow || 'border-slate-800'} hover:border-orange-500/50 transition-colors`}>
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border-2 ${badgeColor}`}>{icon || `${index + 1}`}</div>
                                                <div className="truncate">
                                                    <div className={`font-black text-sm truncate ${index < 3 ? 'text-white' : 'text-slate-300'}`} title={student.name}>{student.name}</div>
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Phá đảo: {student.examsCount} nhiệm vụ</div>
                                                </div>
                                            </div>
                                            <div className="font-black text-orange-400 text-xl shrink-0 drop-shadow-md">
                                                {student.totalScore.toFixed(2)}<span className="text-xs ml-0.5 text-orange-500/50">đ</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ========================================== */}
            {/* MODAL ĐĂNG NHẬP / ĐĂNG KÝ (TỪ TRAINING.JS) */}
            {/* ========================================== */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 rounded-full p-1 transition-colors"><X size={20}/></button>
                        
                        <div className="p-6 md:p-8">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30">
                                    <Shield size={32} className="text-white"/>
                                </div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-wider">HỒ SƠ CHIẾN BINH</h2>
                                <p className="text-sm text-slate-400 mt-1">Ghi danh để lưu lại thành tích của bạn</p>
                            </div>

                            <form onSubmit={handlePhoneAuth} className="space-y-4">
                                {authMode === 'register' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Họ và Tên</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                            <input type="text" required value={authData.name} onChange={e => setAuthData({...authData, name: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 outline-none focus:border-cyan-500 transition-colors" placeholder="VD: Nguyễn Văn A"/>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Số Điện Thoại</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                        <input type="tel" required value={authData.phone} onChange={e => setAuthData({...authData, phone: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 outline-none focus:border-cyan-500 transition-colors" placeholder="Nhập số điện thoại..."/>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Mật Khẩu</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                        <input type={showPassword ? "text" : "password"} required value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 outline-none focus:border-cyan-500 transition-colors" placeholder="Từ 6 ký tự trở lên..."/>
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                                        </button>
                                    </div>
                                </div>

                                {authError && (
                                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                                        <AlertCircle size={16}/> {authError}
                                    </div>
                                )}

                                <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center">
                                    {authLoading ? <Loader2 className="animate-spin" size={24}/> : (authMode === 'login' ? 'ĐĂNG NHẬP NGAY' : 'TẠO HỒ SƠ MỚI')}
                                </button>
                            </form>

                            <div className="mt-6">
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="border-t border-slate-700 w-full"></div>
                                    <span className="bg-[#1e293b] px-4 text-xs text-slate-500 font-medium absolute">HOẶC</span>
                                </div>
                                <button onClick={handleGoogleLogin} disabled={authLoading} className="w-full bg-white hover:bg-gray-100 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-sm">
                                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 41.939 C -8.804 40.009 -11.514 38.989 -14.754 38.989 C -19.444 38.989 -23.494 41.689 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
                                    Đăng nhập với Google
                                </button>
                            </div>

                            <p className="text-center mt-6 text-sm text-slate-400">
                                {authMode === 'login' ? "Chiến binh mới? " : "Đã có hồ sơ? "}
                                <button onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('');}} className="text-cyan-400 font-bold hover:underline">
                                    {authMode === 'login' ? "Ghi danh ngay" : "Đăng nhập"}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #06b6d4; }
            `}</style>
        </div>
    );
}