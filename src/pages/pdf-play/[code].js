import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import useAuthStore from '@/store/useAuthStore';
import { Timer, Send, Shield, CheckCircle, User, FileText, Edit3, Eye, PenTool, ArrowLeft, Zap, Target, Trophy, Lock } from 'lucide-react';
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

    const [answers, setAnswers] = useState({ part1: {}, part2: {}, part3: {} });

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

    // BỘ ĐẾM GIỜ
    useEffect(() => {
        let timer;
        if (isStarted && !isSubmitting && !isFinished) {
            if (timeLeft > 0) {
                timer = setInterval(() => {
                    setTimeLeft(prev => prev - 1);
                }, 1000);
            } else if (timeLeft <= 0) {
                if (handleSubmitRef.current) handleSubmitRef.current(true);
            }
        }
        return () => clearInterval(timer);
    }, [isStarted, timeLeft, isSubmitting, isFinished]);

    // [BẢO MẬT]: CHẶN LƯU (CTRL+S), IN (CTRL+P) VÀ CHUỘT PHẢI (TRÊN GIAO DIỆN WEB)
    useEffect(() => {
        const preventCheating = (e) => {
            if (
                (e.ctrlKey && ['s', 'p', 'c', 'u'].includes(e.key.toLowerCase())) || 
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
            ) {
                e.preventDefault();
                alert("⚠️ HỆ THỐNG BẢO MẬT: Tính năng này đã bị khóa trong giờ thi!");
            }
        };

        const preventRightClick = (e) => {
            if (e.target.tagName !== 'EMBED') {
                e.preventDefault();
            }
        };

        if (isStarted && !isFinished) {
            window.addEventListener('keydown', preventCheating);
            window.addEventListener('contextmenu', preventRightClick);
        }

        return () => {
            window.removeEventListener('keydown', preventCheating);
            window.removeEventListener('contextmenu', preventRightClick);
        };
    }, [isStarted, isFinished]);

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

    const calculateScore = () => {
        let totalScore = 0;
        const key = exam.answerKey || {};

        if (key.part1) {
            Object.keys(key.part1).forEach(qNum => { if (answers.part1[qNum] === key.part1[qNum]) totalScore += 0.25; });
        }
        if (key.part2) {
            Object.keys(key.part2).forEach(qNum => {
                const correctData = key.part2[qNum];
                const studentAnsObj = answers.part2[qNum] || {};
                let matchCount = 0;
                
                const correctArr = Array.isArray(correctData) ? correctData : Object.values(correctData || {});
                
                correctArr.forEach((trueVal, idx) => { 
                    if (studentAnsObj[idx] === trueVal) matchCount++; 
                });

                if (matchCount === 1) totalScore += 0.1;
                else if (matchCount === 2) totalScore += 0.25;
                else if (matchCount === 3) totalScore += 0.5;
                else if (matchCount === 4) totalScore += 1.0;
            });
        }
        if (key.part3) {
            Object.keys(key.part3).forEach(qNum => {
                const stuAns = String(answers.part3[qNum] || "").trim().toLowerCase();
                const trueAns = String(key.part3[qNum] || "").trim().toLowerCase();
                if (stuAns === trueAns && stuAns !== "") totalScore += 0.5;
            });
        }
        return Math.min(10, totalScore).toFixed(2);
    };

    const handleSubmit = async (isAutoSubmit = false) => {
        if (!isFinished && !isAutoSubmit && !confirm("Chốt đáp án và nộp bài? Không thể sửa lại!")) return;
        setIsSubmitting(true);

        try {
            const finalScore = calculateScore();
            setScore(finalScore);

            if (!studentInfo.isGuest) {
                await addDoc(collection(firestore, "pdf_exam_results"), {
                    examId: exam.id, 
                    examCode: exam.code,
                    examTitle: exam.title,
                    studentName: studentInfo.name, 
                    studentClass: exam.grade || 'Tự do',
                    score: parseFloat(finalScore),
                    answers: answers,
                    submittedAt: serverTimestamp()
                });
            }
            setIsFinished(true);
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        } catch (err) { 
            console.error("Lỗi khi chấm điểm/nộp bài: ", err);
            alert("Đã xảy ra lỗi khi nộp bài: " + err.message); 
        } 
        finally { 
            setIsSubmitting(false); 
        }
    };

    useEffect(() => {
        handleSubmitRef.current = handleSubmit;
    });

    if (loading) return <div className="h-screen bg-[#09090b] flex items-center justify-center text-orange-500 font-black animate-pulse text-2xl drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]"><Zap className="inline mr-2" size={30}/> ĐANG GIẢI MÃ...</div>;
    if (!exam) return <div className="h-screen bg-[#09090b] flex items-center justify-center text-red-500 font-black text-xl"><Target className="inline mr-2" size={24}/> MÃ CHIẾN DỊCH KHÔNG TỒN TẠI!</div>;

    const securePdfUrl = exam.pdfUrl?.replace('http://', 'https://');

    // ================= MÀN HÌNH CHỜ (WAITING ROOM) =================
    if (!isStarted) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden font-sans">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 blur-[150px] rounded-full pointer-events-none"></div>
                
                <div className="bg-[#0f172a]/90 backdrop-blur-xl border-2 border-orange-500/50 p-8 md:p-12 rounded-[2.5rem] w-full max-w-lg shadow-[0_0_50px_rgba(249,115,22,0.2)] text-center relative z-10 animate-in zoom-in-95">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
                    
                    <Shield size={60} className="mx-auto text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)] mb-6"/>
                    <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600 drop-shadow-sm">{exam.title}</h1>
                    <div className="flex justify-center items-center gap-4 text-orange-200 font-bold text-sm mb-8 uppercase tracking-widest">
                        <span className="bg-orange-950/50 px-3 py-1 rounded-lg border border-orange-500/30">{exam.timeLimit} Phút</span> 
                        <span className="bg-orange-950/50 px-3 py-1 rounded-lg border border-orange-500/30">{exam.totalQuestions} Câu</span>
                    </div>

                    <div className="bg-gradient-to-r from-[#0a0a0a] to-red-950/30 border border-orange-500/30 p-4 rounded-2xl mb-8 flex items-center justify-between shadow-inner">
                        <div className="text-left flex items-center gap-3">
                            <div className="bg-orange-500/20 p-2 rounded-full border border-orange-500/50 text-orange-400"><User size={20}/></div>
                            <div>
                                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-0.5">Chiến binh</p>
                                <p className="text-white font-black text-sm md:text-base">{studentInfo.name}</p>
                            </div>
                        </div>
                        <CheckCircle size={24} className="text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"/>
                    </div>

                    <button onClick={() => setIsStarted(true)} className="w-full bg-gradient-to-b from-orange-500 to-red-600 border-b-4 border-red-900 active:translate-y-1 active:border-b-0 text-white py-4 rounded-2xl font-black text-xl uppercase tracking-widest shadow-[0_0_30px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center gap-2">
                        BẮT ĐẦU CHIẾN DỊCH
                    </button>
                </div>
            </div>
        );
    }

    // ================= MÀN HÌNH HOÀN THÀNH (FINISHED) =================
    if (isFinished) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans relative overflow-hidden">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-600/20 via-transparent to-transparent pointer-events-none"></div>
                 
                 <div className="bg-[#0f172a]/90 backdrop-blur-xl border-2 border-yellow-500/50 p-8 md:p-10 rounded-[2.5rem] w-full max-w-md text-center relative z-10 animate-in zoom-in">
                    <Trophy size={80} className="text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)]"/>
                    <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-orange-500 uppercase italic tracking-tighter mb-2 drop-shadow-md">HOÀN THÀNH</h2>
                    <p className="text-orange-200 font-bold uppercase tracking-widest text-xs mb-8">Chiến binh: <span className="text-white">{studentInfo.name}</span></p>
                    
                    <div className="bg-black/80 border-2 border-yellow-500/30 p-8 rounded-3xl mb-8 shadow-[inset_0_0_30px_rgba(250,204,21,0.1)] relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest">TỔNG ĐIỂM</div>
                        <p className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-400 to-red-500 drop-shadow-lg">
                            {score}
                        </p>
                    </div>

                    <button onClick={() => router.push('/arena-on-thi')} className="w-full bg-gradient-to-b from-slate-700 to-slate-900 border-b-4 border-black active:translate-y-1 active:border-b-0 hover:from-slate-600 hover:to-slate-800 text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg">
                        VỀ TRANG CHỦ
                    </button>
                 </div>
            </div>
        );
    }

    // ================= MÀN HÌNH LÀM BÀI (ACTIVE EXAM) =================
    return (
        // [VÁ LỖI CỐT LÕI]: Dùng fixed inset-0 để ôm chặt cứng màn hình điện thoại, tránh lỗi tràn của 100dvh
        <div className="fixed inset-0 bg-[#09090b] flex flex-col overflow-hidden font-sans text-slate-200 printable-exam-area">
            
            {/* WRAPPER CHIA MÀN HÌNH (Mobile: Dọc, Desktop: Ngang) */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full relative">
                
                {/* ================= KHU VỰC 1: ĐỀ PDF ================= */}
                {/* Mobile: Ép tỷ lệ flex-[7] (Chiếm đúng 70% không gian). Desktop: flex-1 */}
                <div className="flex-[7] md:flex-1 flex flex-col min-h-0 shrink-0 relative bg-black z-20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] md:shadow-none">
                    
                    {/* HEADER */}
                    <div className="h-[55px] sm:h-[70px] bg-[#050505] border-b-2 border-orange-600 shadow-[0_5px_20px_rgba(249,115,22,0.15)] flex items-center justify-between px-3 md:px-6 shrink-0 relative z-20">
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none"></div>
                        
                        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                            <button onClick={() => { if(confirm('⚠️ Thoát bây giờ sẽ mất toàn bộ bài đang làm. Bạn chắc chứ?')) router.push('/arena-on-thi'); }} className="p-2 sm:p-2.5 bg-gradient-to-b from-orange-500 to-red-600 border-b-[3px] border-red-900 rounded-xl active:translate-y-1 active:border-b-0 transition-all group shrink-0">
                                <ArrowLeft size={16} className="text-white drop-shadow-md sm:w-[18px] sm:h-[18px]" strokeWidth={3}/>
                            </button>
                            <div className="font-black text-sm md:text-lg text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600 uppercase tracking-tighter italic truncate drop-shadow-sm" title={exam.title}>
                                {exam.title}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                            {/* Cảnh báo khóa tải */}
                            <div className="hidden lg:flex items-center gap-1.5 text-red-500 bg-red-950/30 px-3 py-1 rounded-lg border border-red-500/20 text-[10px] font-black uppercase tracking-widest">
                                <Lock size={12}/> Đã khóa Tải/In
                            </div>

                            <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 border border-orange-500/30 pl-3 pr-1.5 py-1 rounded-full shadow-inner">
                                <div className="flex flex-col items-end pr-2">
                                    <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">{studentInfo.isGuest ? 'Chế độ Khách' : 'Chiến Binh'}</span>
                                    <span className="text-xs font-bold text-white leading-none mt-0.5 truncate max-w-[120px]">{studentInfo.name}</span>
                                </div>
                                <User size={24} className="bg-orange-500/20 p-1 rounded-full text-orange-400 border border-orange-500/50"/>
                            </div>
                            
                            <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black text-sm sm:text-xl shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] border-2 ${timeLeft < 300 ? 'bg-red-950/50 text-red-400 border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-[#0a0a0a] text-orange-400 border-orange-500/50 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]'}`}>
                                <Timer size={16} className="sm:w-5 sm:h-5" strokeWidth={2.5}/> {formatTime(timeLeft)}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full bg-white relative min-h-0">
                        {/* BẢO MẬT PDF: Kính cường lực che chuột phải chỉ bật trên máy tính. Mobile để vuốt tự do. */}
                        <div 
                            className="hidden md:block absolute top-0 left-0 bottom-0 right-[20px] z-10 cursor-not-allowed"
                            onContextMenu={(e) => {
                                e.preventDefault();
                                alert("⚠️ HỆ THỐNG BẢO MẬT: Chuột phải đã bị vô hiệu hóa trên vùng đề thi!");
                            }}
                        ></div>
                        <embed src={`${securePdfUrl}#view=FitH&toolbar=0&navpanes=0`} type="application/pdf" className="w-full h-full relative z-0" />
                    </div>
                </div>

                {/* ================= KHU VỰC 2: KHUNG ĐÁP ÁN ================= */}
                {/* Mobile: Ép tỷ lệ flex-[3] (Chiếm đúng 30% không gian). Desktop: Cố định 320px */}
                <div className="flex-[3] md:flex-none md:w-[320px] bg-[#0a0a0a] border-t-2 md:border-t-0 md:border-l-2 border-red-600/50 flex flex-col min-h-0 shadow-[0_-10px_30px_rgba(239,68,68,0.15)] md:shadow-[-10px_0_30px_rgba(239,68,68,0.15)] relative z-30">
                    
                    <div className="h-[35px] md:h-[45px] bg-gradient-to-r from-red-950 to-[#0a0a0a] border-b border-red-500/30 flex items-center justify-center shrink-0 shadow-sm relative">
                        <div className="absolute left-0 top-0 w-1 h-full bg-red-500"></div>
                        <span className="text-[10px] md:text-xs font-black text-red-400 uppercase tracking-[0.3em] flex items-center gap-2 drop-shadow-md"><PenTool size={14} className="md:w-4 md:h-4"/> PHIẾU ĐIỀN ĐÁP ÁN</span>
                    </div>

                    {/* Vùng chứa cuộn: Đã thêm min-h-0 ở các lớp cha để đảm bảo overflow-y-auto hoạt động */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 pb-8 custom-scrollbar space-y-4 md:space-y-6">
                        {/* TRẮC NGHIỆM */}
                        {exam.answerKey?.part1 && Object.keys(exam.answerKey.part1).length > 0 && (
                            <div>
                                <div className="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 bg-orange-950/30 p-2 rounded-lg border border-orange-500/20"><FileText size={14}/> I. TRẮC NGHIỆM</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(exam.answerKey.part1).sort((a,b)=>a-b).map(qNum => (
                                        <div key={qNum} className="flex items-center justify-between bg-slate-900/80 rounded-lg px-2 py-1.5 border border-slate-800 shadow-inner">
                                            <span className="text-[11px] font-bold text-slate-400 w-5 text-center">{qNum}</span>
                                            <div className="flex gap-1">
                                                {['A', 'B', 'C', 'D'].map(opt => {
                                                    const isSel = answers.part1[qNum] === opt;
                                                    return (
                                                        <button key={opt} onClick={() => handlePart1(qNum, opt)} className={`w-6 h-6 sm:w-[26px] sm:h-[26px] rounded-full text-[10px] sm:text-[11px] font-black transition-all ${isSel ? 'bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-[0_0_12px_rgba(249,115,22,0.8)] border-none scale-110' : 'bg-[#111] text-slate-500 hover:bg-slate-800 border border-slate-700'}`}>
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

                        {/* ĐÚNG / SAI */}
                        {exam.answerKey?.part2 && Object.keys(exam.answerKey.part2).length > 0 && (
                            <div>
                                <div className="text-[11px] font-black text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 bg-yellow-950/30 p-2 rounded-lg border border-yellow-500/20"><CheckCircle size={14}/> II. ĐÚNG / SAI</div>
                                <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                                    <table className="w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-black border-b border-slate-800">
                                                <th className="py-3 px-1 border-r border-slate-800 text-[10px] font-black text-slate-500 w-10 uppercase">Câu</th>
                                                <th className="py-3 px-1 border-r border-slate-800 text-[10px] font-black text-slate-500 w-[18%] uppercase">a</th>
                                                <th className="py-3 px-1 border-r border-slate-800 text-[10px] font-black text-slate-500 w-[18%] uppercase">b</th>
                                                <th className="py-3 px-1 border-r border-slate-800 text-[10px] font-black text-slate-500 w-[18%] uppercase">c</th>
                                                <th className="py-3 px-1 text-[10px] font-black text-slate-500 w-[18%] uppercase">d</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {Object.keys(exam.answerKey.part2).sort((a,b)=>a-b).map(qNum => (
                                                <tr key={qNum} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="py-2.5 px-1 border-r border-slate-800 text-xs font-bold text-slate-400 bg-black/50">{qNum}</td>
                                                    {['a', 'b', 'c', 'd'].map((sub, idx) => {
                                                        const val = answers.part2[qNum]?.[idx];
                                                        return (
                                                            <td key={idx} className="py-2.5 px-0.5 border-r border-slate-800 last:border-0 align-middle">
                                                                <div className="flex justify-center rounded overflow-hidden border border-slate-700 w-fit mx-auto bg-[#0a0a0a]">
                                                                    <button onClick={() => handlePart2(qNum, idx, 'Đ')} className={`w-6 h-6 sm:w-7 sm:h-7 text-[10px] sm:text-[11px] font-black flex items-center justify-center transition-all ${val==='Đ' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.6)] z-10 rounded-l' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>Đ</button>
                                                                    <button onClick={() => handlePart2(qNum, idx, 'S')} className={`w-6 h-6 sm:w-7 sm:h-7 text-[10px] sm:text-[11px] font-black flex items-center justify-center transition-all ${val==='S' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] z-10 rounded-r' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>S</button>
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

                        {/* ĐIỀN ĐÁP ÁN */}
                        {exam.answerKey?.part3 && Object.keys(exam.answerKey.part3).length > 0 && (
                            <div>
                                <div className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 bg-red-950/30 p-2 rounded-lg border border-red-500/20"><Edit3 size={14}/> III. ĐIỀN ĐÁP ÁN</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {Object.keys(exam.answerKey.part3).sort((a,b)=>a-b).map(qNum => (
                                        <div key={qNum} className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden focus-within:border-orange-500 focus-within:shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all">
                                            <span className="w-8 bg-black text-center text-xs font-bold text-slate-500 py-2 shrink-0 border-r border-slate-800">C.{qNum}</span>
                                            <input 
                                                type="text" value={answers.part3[qNum] || ''} onChange={(e) => handlePart3(qNum, e.target.value)}
                                                className="w-full bg-transparent text-xs font-black text-orange-400 text-center outline-none px-2 py-2 placeholder:text-slate-700"
                                                placeholder="..."
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* NÚT NỘP BÀI (Chỉ hiện trên PC ở đây, Mobile sẽ có thanh dưới đáy) */}
                    <div className="p-4 shrink-0 border-t border-red-600/30 bg-[#050505] hidden md:block z-20">
                        <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="w-full bg-gradient-to-b from-orange-500 to-red-600 border-b-4 border-red-900 active:translate-y-1 active:border-b-0 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all flex items-center justify-center gap-2">
                            {isSubmitting ? 'ĐANG XỬ LÝ...' : <><Send size={18} strokeWidth={3}/> NỘP BÀI NGAY</>}
                        </button>
                    </div>
                </div>

            </div>

            {/* ================= KHU VỰC 3: NÚT NỘP BÀI BOTTOM DÀNH CHO MOBILE ================= */}
            <div className="md:hidden h-[55px] sm:h-[65px] bg-[#050505] border-t-2 border-orange-600/50 p-2 shrink-0 z-50 relative shadow-[0_-5px_20px_rgba(249,115,22,0.15)]">
                <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="w-full h-full bg-gradient-to-b from-orange-500 to-red-600 border-b-4 border-red-900 active:translate-y-1 active:border-b-0 text-white rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center justify-center gap-2 transition-all">
                    {isSubmitting ? 'ĐANG XỬ LÝ...' : <><Send size={16} strokeWidth={3}/> NỘP BÀI CHIẾN DỊCH</>}
                </button>
            </div>

            {/* BẢO MẬT PDF: Ép CSS màn hình in thành màu trắng bóc nếu học sinh cố tình dùng thủ thuật in */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    html, body {
                        background-color: white !important;
                    }
                    html::before {
                        content: "⚠️ TÍNH NĂNG IN ĐÃ BỊ HỆ THỐNG BẢO MẬT KHÓA ⚠️";
                        visibility: visible !important;
                        display: block;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        color: red;
                        margin-top: 50px;
                        width: 100%;
                        position: absolute;
                        top: 0;
                        left: 0;
                    }
                }
            `}</style>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #ea580c; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }
            `}</style>
        </div>
    );
}