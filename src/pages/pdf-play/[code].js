import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import useAuthStore from '@/store/useAuthStore';
import { Timer, Send, Shield, CheckCircle, User, FileText, Edit3, Eye, PenTool, ArrowLeft, Target, Unlock, Users, Lock, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PDFPlay() {
    const router = useRouter();
    const { code } = router.query;
    const { user } = useAuthStore(); 

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [studentInfo, setStudentInfo] = useState({ name: '', isGuest: true });
    
    const [isStarted, setIsStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);

    // BIẾN ĐIỀU KHIỂN TAB MOBILE (CHỐNG TRÔI)
    const [mobileTab, setMobileTab] = useState('PDF'); 

    const [answers, setAnswers] = useState({ part1: {}, part2: {}, part3: {} });
    
    const [teacherCodeInput, setTeacherCodeInput] = useState('');
    const [studentClassName, setStudentClassName] = useState('');

    const handleSubmitRef = useRef();

    useEffect(() => {
        if (!code) return;
        const fetchExam = async () => {
            try {
                const q = query(collection(firestore, "pdf_exams"), where("code", "==", code));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const examData = { id: snap.docs[0].id, ...snap.docs[0].data() };
                    setExam(examData);
                    setTimeLeft(examData.timeLimit * 60); 
                }
            } catch (err) { console.error(err); } 
            finally { setLoading(false); }
        };
        fetchExam();
    }, [code]);

    useEffect(() => {
        if (user) {
            setStudentInfo({ name: user.displayName || user.email, isGuest: false });
        } else {
            setStudentInfo({ name: `Khách_${Math.floor(Math.random() * 9000) + 1000}`, isGuest: true });
        }
    }, [user]);

    const expectedTeacherCode = (exam && exam.authorId) ? String(exam.authorId).substring(0, 6).toUpperCase() : '';
    const isValidTeacherCode = teacherCodeInput.trim().toUpperCase() === expectedTeacherCode && expectedTeacherCode !== '';

    // LOGIC KIỂM TRA TRƯỚC KHI VÀO THI
    const handleStartClick = () => {
        // Chỉ kiểm tra nếu người dùng (đã đăng nhập) CỐ TÌNH nhập mã GV
        if (!studentInfo.isGuest && teacherCodeInput.trim() !== '') {
            if (!isValidTeacherCode) {
                alert("⚠️ Mã giáo viên không đúng! Vui lòng kiểm tra lại hoặc để trống nếu bạn tự luyện tập.");
                return;
            }
            if (!studentClassName) {
                alert("⚠️ Vui lòng chọn/nhập Tên Lớp của bạn để giáo viên thống kê!");
                return;
            }
        }
        setIsStarted(true);
    };

    const calculateScore = () => {
        let totalScore = 0;
        const key = exam.answerKey || {};

        if (key.part1) {
            Object.keys(key.part1).forEach(qNum => { if (answers.part1[qNum] === key.part1[qNum]) totalScore += 0.25; });
        }
        if (key.part2) {
            Object.keys(key.part2).forEach(qNum => {
                const correctArr = key.part2[qNum];
                const studentAnsObj = answers.part2[qNum] || {};
                let matchCount = 0;
                correctArr.forEach((trueVal, idx) => { if (studentAnsObj[idx] === trueVal) matchCount++; });
                if (matchCount === 1) totalScore += 0.1;
                else if (matchCount === 2) totalScore += 0.25;
                else if (matchCount === 3) totalScore += 0.5;
                else if (matchCount === 4) totalScore += 1.0;
            });
        }
        if (key.part3) {
            Object.keys(key.part3).forEach(qNum => {
                const stuAns = String(answers.part3[qNum] || "").trim().toLowerCase();
                const trueAns = String(key.part3[qNum]).trim().toLowerCase();
                if (stuAns === trueAns && stuAns !== "") totalScore += 0.5;
            });
        }
        return Math.min(10, totalScore).toFixed(2);
    };

    const handleSubmit = async (isTimeOut = false) => {
        if (!isFinished && !isTimeOut && !confirm("Chốt đáp án và nộp bài? Không thể sửa lại!")) return;
        setIsSubmitting(true);
        const finalScore = calculateScore();
        setScore(finalScore);

        try {
            // Nếu là khách -> không lưu dữ liệu
            if (!studentInfo.isGuest) {
                await addDoc(collection(firestore, "exam_results"), {
                    module: 'PDF_ARENA',
                    examId: exam.id, 
                    examCode: exam.code,
                    examTitle: exam.title,
                    studentName: studentInfo.name, 
                    studentClass: 'Chiến binh',
                    score: finalScore,
                    answers: answers,
                    submittedAt: serverTimestamp(),
                    grade: exam.grade || 'Khác',
                    subject: exam.subject || 'Khác',
                    // Chỉ gán ID Giáo Viên nếu học sinh đã nhập đúng Mã GV
                    teacherId: isValidTeacherCode ? exam.authorId : '',
                    teacherCode: isValidTeacherCode ? teacherCodeInput.trim().toUpperCase() : '',
                    studentClassName: isValidTeacherCode ? studentClassName.trim().toUpperCase() : ''
                });
            }
            setIsFinished(true);
            confetti({ particleCount: 300, spread: 120, origin: { y: 0.6 }, colors: ['#06b6d4', '#ec4899', '#eab308', '#8b5cf6'], zIndex: 9999 });
        } catch (err) { 
            alert("Lỗi khi nộp bài: " + err.message); 
        } 
        finally { 
            setIsSubmitting(false); 
        }
    };
    
    handleSubmitRef.current = handleSubmit;

    useEffect(() => {
        let timer;
        if (isStarted && timeLeft > 0 && !isSubmitting && !isFinished) {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) { 
                        clearInterval(timer); 
                        handleSubmitRef.current(true); 
                        return 0; 
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isStarted, isSubmitting, isFinished]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60); const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handlePart1 = (qNum, opt) => setAnswers(p => ({ ...p, part1: { ...p.part1, [qNum]: opt } }));
    const handlePart2 = (qNum, subIdx, val) => setAnswers(p => {
        const curQ = p.part2[qNum] || {};
        return { ...p, part2: { ...p.part2, [qNum]: { ...curQ, [subIdx]: val } } };
    });
    const handlePart3 = (qNum, val) => setAnswers(p => ({ ...p, part3: { ...p.part3, [qNum]: val } }));

    if (loading) return <div className="h-screen w-full bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,1)]" size={60}/></div>;
    if (!exam) return <div className="h-screen w-full bg-[#020617] flex items-center justify-center text-red-500 font-black text-2xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">MÃ CHIẾN DỊCH KHÔNG TỒN TẠI!</div>;

    const securePdfUrl = exam.pdfUrl?.replace('http://', 'https://');

    // ===============================================
    // 1. MÀN HÌNH CHỜ THI
    // ===============================================
    if (!isStarted) {
        return (
            <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-4 overflow-hidden font-sans">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/20 blur-[150px] rounded-full pointer-events-none animate-pulse"></div>
                <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-cyan-500/50 p-8 md:p-10 rounded-[2rem] w-full max-w-lg shadow-[0_0_50px_rgba(6,182,212,0.4)] text-center relative z-10 animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
                    <Shield size={50} className="mx-auto text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)] mb-4"/>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase italic tracking-tighter mb-2 drop-shadow-md">{exam.title}</h1>
                    <div className="flex justify-center items-center gap-4 text-cyan-200 font-bold text-sm mb-6 uppercase tracking-widest">
                        <span className="bg-slate-900 px-3 py-1 rounded-lg border border-cyan-900 shadow-inner">{exam.timeLimit} Phút</span>
                        <span className="bg-slate-900 px-3 py-1 rounded-lg border border-cyan-900 shadow-inner">{exam.totalQuestions} Câu</span>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700 p-3.5 rounded-xl mb-4 flex items-center justify-between shadow-inner">
                        <div className="text-left">
                            <p className="text-[10px] text-cyan-500 font-black uppercase tracking-widest mb-1">Thí sinh</p>
                            <p className="text-white font-black text-sm drop-shadow-md">{studentInfo.name}</p>
                        </div>
                        <CheckCircle size={20} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]"/>
                    </div>

                    {/* NẾU LÀ CHIẾN BINH THÌ MỚI HIỂN THỊ Ô NHẬP MÃ GV */}
                    {!studentInfo.isGuest && (
                        <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl mb-6 flex flex-col text-left transition-all shadow-inner">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest flex items-center gap-1"><Lock size={12}/> Mã Giáo Viên (Tùy chọn)</p>
                                    {teacherCodeInput.trim() !== '' && (
                                        isValidTeacherCode 
                                        ? <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 animate-in zoom-in"><CheckCircle size={10}/> Mã Hợp lệ</span>
                                        : <span className="text-[10px] text-red-400 font-bold flex items-center gap-1 animate-in zoom-in"><X size={10}/> Mã không đúng</span>
                                    )}
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Nhập mã GV nếu có yêu cầu..."
                                    value={teacherCodeInput}
                                    onChange={(e) => setTeacherCodeInput(e.target.value)}
                                    // text-base ĐỂ CHỐNG ZOOM TRÊN IPHONE
                                    className={`w-full bg-black/50 border rounded-lg px-3 py-2.5 text-white outline-none text-base font-bold transition-all placeholder:text-slate-600 uppercase ${teacherCodeInput.trim() !== '' ? (isValidTeacherCode ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.3)]') : 'border-slate-700 focus:border-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)]'}`}
                                />
                            </div>

                            {/* CHỈ HIỆN CHỌN LỚP KHI MÃ GV HỢP LỆ */}
                            {isValidTeacherCode && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-500 mt-4 border-t border-slate-700/50 pt-4">
                                    <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1"><Users size={12}/> Tên Lớp của bạn</p>
                                    {exam.allowedClasses && exam.allowedClasses.length > 0 ? (
                                        <select 
                                            value={studentClassName}
                                            onChange={(e) => setStudentClassName(e.target.value)}
                                            className="w-full bg-black/50 border border-cyan-700 rounded-lg px-3 py-2.5 text-white outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.4)] text-base font-bold transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">-- Chọn danh sách lớp --</option>
                                            {exam.allowedClasses.map(c => <option key={`cls-${c}`} value={c}>{c}</option>)}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            placeholder="VD: 12A1, 10A5..."
                                            value={studentClassName}
                                            onChange={(e) => setStudentClassName(e.target.value)}
                                            className="w-full bg-black/50 border border-cyan-700 rounded-lg px-3 py-2.5 text-white outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.4)] text-base font-bold transition-all placeholder:text-slate-500 uppercase"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={handleStartClick} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-widest shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all hover:scale-105 active:scale-95 border border-cyan-400/50">
                        BẮT ĐẦU LÀM BÀI
                    </button>
                </div>
            </div>
        );
    }

    // ===============================================
    // 2. MÀN HÌNH KẾT QUẢ (HIỂN THỊ ĐÁP ÁN NẾU ĐƯỢC PHÉP)
    // ===============================================
    if (isFinished) {
        return (
            <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-4 font-sans relative overflow-hidden">
                 <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-emerald-500/50 p-8 rounded-[2rem] w-full max-w-md text-center relative z-10 animate-in zoom-in max-h-[95vh] overflow-y-auto custom-scrollbar shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                    <CheckCircle size={80} className="text-emerald-400 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]"/>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2 drop-shadow-md">ĐÃ NỘP BÀI</h2>
                    <p className="text-emerald-200 font-bold uppercase tracking-widest text-sm mb-6">Thí sinh: <span className="text-white drop-shadow-[0_0_5px_white]">{studentInfo.name}</span></p>
                    
                    <div className="bg-black/60 border border-emerald-500/50 p-6 rounded-3xl mb-6 shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]">
                        <p className="text-emerald-500 text-xs font-black uppercase tracking-[0.3em] mb-2 drop-shadow-md">ĐIỂM TỔNG KẾT</p>
                        <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]">{score}</p>
                    </div>

                    {/* HIỂN THỊ ĐÁP ÁN THEO CÀI ĐẶT CỦA GIÁO VIÊN */}
                    {exam.showAnswers && exam.answerKey && (
                        <div className="bg-slate-900/90 border border-cyan-500/50 p-4 rounded-2xl mb-6 text-left text-sm text-slate-300 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)] animate-in fade-in duration-500">
                            <p className="text-cyan-400 font-black uppercase tracking-widest text-xs mb-3 flex items-center gap-2 border-b border-cyan-900 pb-2 drop-shadow-md"><Unlock size={14}/> ĐÁP ÁN CHUẨN CỦA GV</p>
                            
                            {exam.answerKey.part1 && Object.keys(exam.answerKey.part1).length > 0 && (
                                <div className="mb-3">
                                    <span className="font-bold text-white text-[11px]">PHẦN I:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {Object.entries(exam.answerKey.part1).sort(([a],[b])=>a-b).map(([q, a]) => (
                                            <span key={`ans1-${q}`} className="bg-black border border-slate-800 px-2 py-1 rounded text-[10px] shadow-sm">C{q}: <span className="text-cyan-400 font-bold text-[12px]">{a}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {exam.answerKey.part2 && Object.keys(exam.answerKey.part2).length > 0 && (
                                <div className="mb-3">
                                    <span className="font-bold text-white text-[11px]">PHẦN II:</span>
                                    <div className="grid grid-cols-2 gap-1 mt-1">
                                        {Object.entries(exam.answerKey.part2).sort(([a],[b])=>a-b).map(([q, aArr]) => (
                                            <span key={`ans2-${q}`} className="bg-black border border-slate-800 px-2 py-1 rounded text-[10px] shadow-sm">C{q}: <span className="text-pink-400 font-bold tracking-widest">{aArr.join('-')}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {exam.answerKey.part3 && Object.keys(exam.answerKey.part3).length > 0 && (
                                <div>
                                    <span className="font-bold text-white text-[11px]">PHẦN III:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {Object.entries(exam.answerKey.part3).sort(([a],[b])=>a-b).map(([q, a]) => (
                                            <span key={`ans3-${q}`} className="bg-black border border-slate-800 px-2 py-1 rounded text-[10px] shadow-sm">C{q}: <span className="text-yellow-400 font-bold text-[12px]">{a}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={() => router.push('/arena-on-thi')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-slate-700/50">
                        VỀ TRANG CHỦ
                    </button>
                 </div>
            </div>
        );
    }

    // ===============================================
    // 3. MÀN HÌNH LÀM BÀI CHÍNH (KHÓA CỨNG CHỐNG TRÔI)
    // ===============================================
    return (
        <div className="fixed inset-0 bg-[#020617] flex flex-col md:flex-row overflow-hidden font-sans text-slate-200 selection:bg-cyan-500 selection:text-white">
            
            {/* CỘT TRÁI: ĐỀ PDF (Bật/Tắt trên Mobile dựa theo mobileTab) */}
            <div className={`${mobileTab === 'PDF' ? 'flex' : 'hidden'} md:flex h-full md:flex-[3] flex-col relative bg-[#09090b] z-10 border-b md:border-b-0 border-cyan-900/50 pb-[60px] md:pb-0`}>
                
                <div className="h-[55px] sm:h-[65px] bg-[#020617] flex items-center justify-between px-3 md:px-6 shrink-0 shadow-[0_5px_30px_rgba(6,182,212,0.15)] z-10">
                    <div className="flex items-center gap-2 md:gap-4 overflow-hidden max-w-[50%]">
                        <div className="p-2 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.5)] hidden sm:flex">
                            <Target size={20} className="text-white" />
                        </div>
                        <div className="truncate">
                            <div className="text-[9px] md:text-[10px] font-black text-cyan-500 uppercase tracking-widest leading-none mb-1 hidden sm:block">MÃ NHIỆM VỤ</div>
                            <div className="font-black text-xs sm:text-sm md:text-lg text-white uppercase tracking-wide truncate leading-none drop-shadow-md" title={exam.title}>{exam.title}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6 shrink-0">
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{studentInfo.isGuest ? 'CHẾ ĐỘ KHÁCH' : 'CHIẾN BINH'}</span>
                            <span className="text-sm font-bold text-cyan-300 leading-none mt-1 drop-shadow-[0_0_5px_rgba(103,232,249,0.8)]">{studentInfo.name}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border-2 font-black text-sm sm:text-lg md:text-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] transition-colors duration-500 ${timeLeft < 300 ? 'bg-red-950/80 text-red-400 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-cyan-950/50 text-cyan-400 border-cyan-500/50'}`}>
                            <Timer size={20} className={timeLeft < 300 ? 'animate-bounce text-red-400' : 'text-cyan-400'}/> {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full relative p-1 sm:p-2 overflow-hidden bg-black">
                    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-[inset_0_0_50px_rgba(0,0,0,1)] bg-white relative z-0">
                        <iframe src={`${securePdfUrl}#view=FitH&toolbar=0&navpanes=0`} className="w-full h-full border-none absolute inset-0" title="PDF Exam"/>
                    </div>
                </div>
            </div>

            {/* CỘT PHẢI: BẢNG TRẢ LỜI (Bật/Tắt trên Mobile dựa theo mobileTab) */}
            <div className={`${mobileTab === 'ANSWERS' ? 'flex' : 'hidden'} md:flex h-full md:flex-[1.5] md:max-w-[340px] xl:max-w-[380px] bg-[#020617] border-slate-800 flex-col md:shadow-[-10px_0_30px_rgba(0,0,0,0.8)] relative z-20 pb-[60px] md:pb-0`}>
                
                <div className="h-[45px] sm:h-[55px] bg-[#050505] border-b border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-md">
                    <div className="flex items-center gap-2 text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                        <PenTool size={16}/>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] italic">BẢNG TRẢ LỜI</span>
                    </div>
                    <div className="md:hidden text-[10px] font-black text-cyan-500 uppercase tracking-widest">{studentInfo.name}</div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 sm:p-3 custom-scrollbar space-y-4 sm:space-y-6 bg-[#09090b]">
                    
                    {exam.answerKey?.part1 && Object.keys(exam.answerKey.part1).length > 0 && (
                        <div className="bg-slate-900/60 rounded-2xl p-2 sm:p-3 border border-slate-800 shadow-inner">
                            <div className="text-[10px] sm:text-xs font-black text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 drop-shadow-md"><FileText size={14}/> I. TRẮC NGHIỆM</div>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                {Object.keys(exam.answerKey.part1).sort((a,b)=>a-b).map(qNum => (
                                    <div key={`p1-${qNum}`} className="flex items-center justify-between bg-black/60 rounded-xl px-2 py-1.5 sm:py-2 border border-slate-800 shadow-sm hover:border-cyan-900 transition-colors">
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-500 w-5 text-center">{qNum}</span>
                                        <div className="flex gap-1 sm:gap-1.5">
                                            {['A', 'B', 'C', 'D'].map(opt => {
                                                const isSel = answers.part1[qNum] === opt;
                                                return (
                                                    <button key={`p1-${qNum}-${opt}`} onClick={() => handlePart1(qNum, opt)} className={`w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full text-[10px] sm:text-[11px] font-black transition-all ${isSel ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-110 border border-cyan-300 z-10 relative' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}>
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {exam.answerKey?.part2 && Object.keys(exam.answerKey.part2).length > 0 && (
                        <div className="bg-slate-900/60 rounded-2xl p-2 sm:p-3 border border-slate-800 shadow-inner">
                            <div className="text-[10px] sm:text-xs font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 drop-shadow-md"><CheckCircle size={14}/> II. ĐÚNG / SAI</div>
                            <div className="bg-black/60 rounded-xl border border-slate-800 overflow-hidden shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                                <table className="w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800">
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-600 w-10 sm:w-12">Câu</th>
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">A</th>
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">B</th>
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">C</th>
                                            <th className="py-2 sm:py-3 px-1 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">D</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {Object.keys(exam.answerKey.part2).sort((a,b)=>a-b).map(qNum => (
                                            <tr key={`p2-${qNum}`} className="hover:bg-slate-900/50 transition-colors">
                                                <td className="py-2 sm:py-3 px-1 border-r border-slate-800 text-xs sm:text-sm font-bold text-slate-400 bg-slate-950/30">{qNum}</td>
                                                {['a', 'b', 'c', 'd'].map((sub, idx) => {
                                                    const val = answers.part2[qNum]?.[idx];
                                                    return (
                                                        <td key={`p2-${qNum}-${idx}`} className="py-2 sm:py-3 px-0.5 border-r border-slate-800 last:border-0 align-middle">
                                                            <div className="flex justify-center rounded overflow-hidden border border-slate-700 shadow-sm w-fit mx-auto bg-slate-950">
                                                                <button onClick={() => handlePart2(qNum, idx, 'Đ')} className={`w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] text-[9px] sm:text-[10px] font-black flex items-center justify-center transition-all ${val==='Đ' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.8)] scale-110 z-10 relative' : 'text-slate-500 hover:bg-slate-800'}`}>Đ</button>
                                                                <button onClick={() => handlePart2(qNum, idx, 'S')} className={`w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] text-[9px] sm:text-[10px] font-black flex items-center justify-center transition-all ${val==='S' ? 'bg-pink-500 text-black shadow-[0_0_15px_rgba(236,72,153,0.8)] scale-110 z-10 relative' : 'text-slate-500 hover:bg-slate-800'}`}>S</button>
                                                            </div>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {exam.answerKey?.part3 && Object.keys(exam.answerKey.part3).length > 0 && (
                        <div className="bg-slate-900/60 rounded-2xl p-2 sm:p-3 border border-slate-800 shadow-inner">
                            <div className="text-[10px] sm:text-xs font-black text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 drop-shadow-md"><Edit3 size={14}/> III. ĐIỀN ĐÁP ÁN</div>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                {Object.keys(exam.answerKey.part3).sort((a,b)=>a-b).map(qNum => (
                                    <div key={`p3-${qNum}`} className="flex items-center bg-black/60 border border-slate-800 rounded-xl overflow-hidden shadow-[inset_0_0_8px_rgba(0,0,0,0.8)] focus-within:border-yellow-500/80 focus-within:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all">
                                        <span className="w-6 sm:w-8 bg-slate-950 text-center text-xs sm:text-sm font-bold text-slate-600 py-1.5 sm:py-2 shrink-0 border-r border-slate-800">{qNum}</span>
                                        {/* text-base ĐỂ CHỐNG ZOOM TRÊN IPHONE KHI GÕ */}
                                        <input 
                                            type="text" value={answers.part3[qNum] || ''} onChange={(e) => handlePart3(qNum, e.target.value)}
                                            className="w-full bg-transparent text-base sm:text-sm font-black text-yellow-400 text-center outline-none px-2 py-1.5 sm:py-2 placeholder:text-slate-700"
                                            placeholder="..."
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* NÚT NỘP BÀI DÀNH CHO BẢN MÁY TÍNH */}
                <div className="hidden md:block h-[70px] bg-[#020617] border-t border-slate-800 p-3 shrink-0 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
                    <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="w-full h-full bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-400 text-white rounded-xl font-black uppercase text-sm tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)] active:scale-95 flex items-center justify-center gap-2 transition-all">
                        {isSubmitting ? 'ĐANG XỬ LÝ...' : <><Send size={16} strokeWidth={3} className="drop-shadow-md"/> NỘP BÀI CHIẾN DỊCH</>}
                    </button>
                </div>
            </div>

            {/* THANH CÔNG CỤ DƯỚI ĐÁY CHO MOBILE (CHỐNG TRÔI) */}
            <div className="md:hidden absolute bottom-0 left-0 right-0 h-[60px] bg-[#050505] border-t border-cyan-900/50 flex items-center justify-between p-1.5 shrink-0 z-50">
                <button onClick={() => setMobileTab('PDF')} className={`flex-1 flex flex-col items-center justify-center rounded-lg h-full transition-colors ${mobileTab === 'PDF' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 shadow-[inset_0_0_10px_rgba(6,182,212,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Eye size={20} className="mb-0.5"/><span className="text-[10px] font-black uppercase tracking-widest">Xem Đề</span>
                </button>
                <button onClick={() => setMobileTab('ANSWERS')} className={`flex-1 flex flex-col items-center justify-center rounded-lg h-full transition-colors mx-1.5 ${mobileTab === 'ANSWERS' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 shadow-[inset_0_0_10px_rgba(6,182,212,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}>
                    <PenTool size={20} className="mb-0.5"/><span className="text-[10px] font-black uppercase tracking-widest">Tô Đáp Án</span>
                </button>
                <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="flex-[1.2] h-full bg-gradient-to-b from-red-500 to-red-700 text-white rounded-lg font-black uppercase text-[11px] shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95 flex flex-col items-center justify-center border border-red-400 transition-all">
                    <Send size={18} className="mb-0.5"/>NỘP BÀI
                </button>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #020617; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 5px; border: 1px solid #0f172a; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #06b6d4; border-color: #0891b2; box-shadow: 0 0 10px #06b6d4; }
            `}</style>
        </div>
    );
}