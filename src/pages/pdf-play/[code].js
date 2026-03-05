import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import useAuthStore from '@/store/useAuthStore';
import { Timer, Send, Shield, CheckCircle, User, FileText, Edit3, Eye, PenTool, ArrowLeft, Target, Unlock, Users, Lock } from 'lucide-react';
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
    
    // Mã giáo viên và Tên Lớp
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

    const handleStartClick = () => {
        if (exam?.allowedClasses && exam.allowedClasses.length > 0 && !studentClassName) {
            alert("⚠️ Vui lòng chọn Tên Lớp của bạn trước khi làm bài!");
            return;
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
            if (!studentInfo.isGuest) {
                await addDoc(collection(firestore, "exam_results"), {
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
                    teacherId: exam.authorId || '',
                    teacherCode: teacherCodeInput.trim().toUpperCase(),
                    studentClassName: studentClassName.trim().toUpperCase()
                });
            }
            setIsFinished(true);
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
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

    if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center text-cyan-400 font-black animate-pulse text-2xl">ĐANG GIẢI MÃ...</div>;
    if (!exam) return <div className="h-screen bg-[#020617] flex items-center justify-center text-red-500 font-black text-xl">MÃ CHIẾN DỊCH KHÔNG TỒN TẠI!</div>;

    const securePdfUrl = exam.pdfUrl?.replace('http://', 'https://');

    // --- MÀN HÌNH CHỜ THI ---
    if (!isStarted) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/20 blur-[120px] rounded-full pointer-events-none"></div>
                <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-cyan-500/50 p-8 md:p-10 rounded-[2rem] w-full max-w-lg shadow-[0_0_50px_rgba(6,182,212,0.3)] text-center relative z-10 animate-in zoom-in-95">
                    <Shield size={40} className="mx-auto text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] mb-4"/>
                    <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">{exam.title}</h1>
                    <div className="flex justify-center items-center gap-4 text-slate-400 font-bold text-sm mb-6 uppercase">
                        <span>{exam.timeLimit} Phút</span> • <span>{exam.totalQuestions} Câu</span>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700 p-3.5 rounded-xl mb-4 flex items-center justify-between">
                        <div className="text-left">
                            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1">Thí sinh</p>
                            <p className="text-white font-black text-sm">{studentInfo.name}</p>
                        </div>
                        <CheckCircle size={18} className="text-emerald-400"/>
                    </div>

                    {/* KHUNG CHỌN LỚP VÀ NHẬP MÃ GV */}
                    <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl mb-6 flex flex-col gap-3 text-left">
                         <div>
                             <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1"><Users size={12}/> Tên Lớp của bạn</p>
                             {exam.allowedClasses && exam.allowedClasses.length > 0 ? (
                                 <select 
                                     value={studentClassName}
                                     onChange={(e) => setStudentClassName(e.target.value)}
                                     className="w-full bg-black/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] text-sm font-bold transition-all appearance-none cursor-pointer"
                                 >
                                     <option value="">-- Chọn lớp của bạn --</option>
                                     {exam.allowedClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                             ) : (
                                 <input 
                                    type="text" 
                                    placeholder="VD: 12A1, 10A5... (Tùy chọn)"
                                    value={studentClassName}
                                    onChange={(e) => setStudentClassName(e.target.value)}
                                    className="w-full bg-black/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] text-sm font-bold transition-all placeholder:text-slate-600 uppercase"
                                 />
                             )}
                         </div>
                         <div>
                             <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1"><Lock size={12}/> Mã Giáo Viên (Tùy chọn)</p>
                             <input 
                                type="text" 
                                placeholder="Nhập mã GV nếu có yêu cầu..."
                                value={teacherCodeInput}
                                onChange={(e) => setTeacherCodeInput(e.target.value)}
                                className="w-full bg-black/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.3)] text-sm font-bold transition-all placeholder:text-slate-600 uppercase"
                             />
                         </div>
                    </div>

                    <button onClick={handleStartClick} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-widest shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all hover:scale-105 active:scale-95">
                        BẮT ĐẦU LÀM BÀI
                    </button>
                </div>
            </div>
        );
    }

    // --- MÀN HÌNH KẾT QUẢ ---
    if (isFinished) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans relative">
                 <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-emerald-500/50 p-8 rounded-[2rem] w-full max-w-md text-center relative z-10 animate-in zoom-in max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <CheckCircle size={80} className="text-emerald-400 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]"/>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">ĐÃ NỘP BÀI</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-6">Thí sinh: <span className="text-white">{studentInfo.name}</span></p>
                    
                    <div className="bg-black/50 border border-emerald-500/30 p-6 rounded-2xl mb-6 shadow-inner">
                        <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.3em] mb-2">ĐIỂM TỔNG KẾT</p>
                        <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600">{score}</p>
                    </div>

                    {exam.showAnswers && exam.answerKey && (
                        <div className="bg-slate-900 border border-cyan-500/30 p-4 rounded-2xl mb-6 text-left text-sm text-slate-300 shadow-inner">
                            <p className="text-cyan-400 font-black uppercase tracking-widest text-xs mb-3 flex items-center gap-2 border-b border-slate-700 pb-2"><Unlock size={14}/> ĐÁP ÁN CHUẨN CỦA GV</p>
                            
                            {exam.answerKey.part1 && Object.keys(exam.answerKey.part1).length > 0 && (
                                <div className="mb-3">
                                    <span className="font-bold text-white text-[11px]">PHẦN I:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {Object.entries(exam.answerKey.part1).sort(([a],[b])=>a-b).map(([q, a]) => (
                                            <span key={q} className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">C{q}: <span className="text-cyan-400 font-bold">{a}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {exam.answerKey.part2 && Object.keys(exam.answerKey.part2).length > 0 && (
                                <div className="mb-3">
                                    <span className="font-bold text-white text-[11px]">PHẦN II:</span>
                                    <div className="grid grid-cols-2 gap-1 mt-1">
                                        {Object.entries(exam.answerKey.part2).sort(([a],[b])=>a-b).map(([q, aArr]) => (
                                            <span key={q} className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">C{q}: <span className="text-pink-400 font-bold">{aArr.join(' - ')}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {exam.answerKey.part3 && Object.keys(exam.answerKey.part3).length > 0 && (
                                <div>
                                    <span className="font-bold text-white text-[11px]">PHẦN III:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {Object.entries(exam.answerKey.part3).sort(([a],[b])=>a-b).map(([q, a]) => (
                                            <span key={q} className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">C{q}: <span className="text-yellow-400 font-bold">{a}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={() => router.push('/')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-all">
                        VỀ TRANG CHỦ
                    </button>
                 </div>
                 <style jsx>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
                 `}</style>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-[#020617] flex flex-col md:flex-row overflow-hidden font-sans text-slate-200">
            <div className="flex-[3] flex flex-col h-[50vh] md:h-screen relative bg-black">
                <div className="h-[55px] sm:h-[65px] bg-[#050505] border-b-2 border-cyan-500/30 flex items-center justify-between px-3 md:px-6 shrink-0 shadow-[0_5px_20px_rgba(6,182,212,0.15)] z-10">
                    <div className="flex items-center gap-2 md:gap-4 overflow-hidden max-w-[50%]">
                        <div className="p-2 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] hidden sm:flex">
                            <Target size={20} className="text-white" />
                        </div>
                        <div className="truncate">
                            <div className="text-[9px] md:text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none mb-1 hidden sm:block">MÃ NHIỆM VỤ</div>
                            <div className="font-black text-xs sm:text-sm md:text-lg text-white uppercase tracking-wide truncate leading-none" title={exam.title}>{exam.title}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6 shrink-0">
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{studentInfo.isGuest ? 'CHẾ ĐỘ KHÁCH' : 'CHIẾN BINH'}</span>
                            <span className="text-sm font-bold text-cyan-300 leading-none mt-1">{studentInfo.name}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border-2 font-black text-sm sm:text-lg md:text-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] ${timeLeft < 300 ? 'bg-red-950/40 text-red-400 border-red-500 animate-pulse' : 'bg-cyan-950/30 text-cyan-400 border-cyan-500/50'}`}>
                            <Timer size={20} className={timeLeft < 300 ? 'animate-bounce' : ''}/> {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full bg-[#111] relative p-1 sm:p-2 overflow-hidden">
                    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-white">
                        <iframe src={`${securePdfUrl}#view=FitH&toolbar=0&navpanes=0`} className="w-full h-full border-none" title="PDF Exam"/>
                    </div>
                </div>
            </div>

            <div className="flex-[1.5] md:max-w-[340px] xl:max-w-[380px] h-[50vh] md:h-screen bg-[#0a0a0a] border-l-2 border-slate-800 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] relative z-20">
                <div className="h-[45px] sm:h-[55px] bg-[#050505] border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-2 text-red-400">
                        <PenTool size={16}/>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] italic">BẢNG TRẢ LỜI</span>
                    </div>
                    <div className="md:hidden text-[10px] font-black text-slate-500 uppercase tracking-widest">{studentInfo.name}</div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 sm:p-3 custom-scrollbar space-y-4 sm:space-y-6 pb-20 md:pb-3">
                    {exam.answerKey?.part1 && Object.keys(exam.answerKey.part1).length > 0 && (
                        <div className="bg-slate-900/50 rounded-2xl p-2 sm:p-3 border border-slate-800/50">
                            <div className="text-[10px] sm:text-xs font-black text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><FileText size={14}/> I. TRẮC NGHIỆM</div>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                {Object.keys(exam.answerKey.part1).sort((a,b)=>a-b).map(qNum => (
                                    <div key={qNum} className="flex items-center justify-between bg-black/40 rounded-xl px-2 py-1.5 sm:py-2 border border-slate-800">
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 w-5 text-center">{qNum}</span>
                                        <div className="flex gap-1 sm:gap-1.5">
                                            {['A', 'B', 'C', 'D'].map(opt => {
                                                const isSel = answers.part1[qNum] === opt;
                                                return (
                                                    <button key={opt} onClick={() => handlePart1(qNum, opt)} className={`w-[20px] h-[20px] sm:w-[26px] sm:h-[26px] rounded-full text-[9px] sm:text-[11px] font-black transition-all ${isSel ? 'bg-cyan-500 text-black shadow-[0_0_10px_#22d3ee] scale-110' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 border border-slate-700'}`}>
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
                        <div className="bg-slate-900/50 rounded-2xl p-2 sm:p-3 border border-slate-800/50">
                            <div className="text-[10px] sm:text-xs font-black text-pink-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><CheckCircle size={14}/> II. ĐÚNG / SAI</div>
                            <div className="bg-black/40 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                                <table className="w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900/80 border-b border-slate-800">
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-10 sm:w-12">Câu</th>
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">A</th>
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">B</th>
                                            <th className="py-2 sm:py-3 px-1 border-r border-slate-800 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">C</th>
                                            <th className="py-2 sm:py-3 px-1 text-[9px] sm:text-[11px] font-black text-slate-500 w-[18%]">D</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {Object.keys(exam.answerKey.part2).sort((a,b)=>a-b).map(qNum => (
                                            <tr key={qNum} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="py-2 sm:py-3 px-1 border-r border-slate-800 text-xs sm:text-sm font-bold text-slate-300 bg-slate-900/30">{qNum}</td>
                                                {['a', 'b', 'c', 'd'].map((sub, idx) => {
                                                    const val = answers.part2[qNum]?.[idx];
                                                    return (
                                                        <td key={idx} className="py-2 sm:py-3 px-0.5 border-r border-slate-800 last:border-0 align-middle">
                                                            <div className="flex justify-center rounded overflow-hidden border border-slate-700 shadow-sm w-fit mx-auto bg-slate-900">
                                                                <button onClick={() => handlePart2(qNum, idx, 'Đ')} className={`w-[18px] h-[18px] sm:w-[24px] sm:h-[24px] text-[8px] sm:text-[10px] font-black flex items-center justify-center transition-colors ${val==='Đ' ? 'bg-emerald-500 text-black shadow-[0_0_10px_#10b981]' : 'text-slate-500 hover:bg-slate-700'}`}>Đ</button>
                                                                <button onClick={() => handlePart2(qNum, idx, 'S')} className={`w-[18px] h-[18px] sm:w-[24px] sm:h-[24px] text-[8px] sm:text-[10px] font-black flex items-center justify-center transition-colors ${val==='S' ? 'bg-pink-500 text-black shadow-[0_0_10px_#ec4899]' : 'text-slate-500 hover:bg-slate-700'}`}>S</button>
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
                        <div className="bg-slate-900/50 rounded-2xl p-2 sm:p-3 border border-slate-800/50">
                            <div className="text-[10px] sm:text-xs font-black text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Edit3 size={14}/> III. ĐIỀN ĐÁP ÁN</div>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                {Object.keys(exam.answerKey.part3).sort((a,b)=>a-b).map(qNum => (
                                    <div key={qNum} className="flex items-center bg-black/40 border border-slate-800 rounded-xl overflow-hidden shadow-inner focus-within:border-yellow-500/50 transition-colors">
                                        <span className="w-6 sm:w-8 bg-slate-900 text-center text-xs sm:text-sm font-bold text-slate-500 py-1.5 sm:py-2 shrink-0 border-r border-slate-800">{qNum}</span>
                                        <input 
                                            type="text" value={answers.part3[qNum] || ''} onChange={(e) => handlePart3(qNum, e.target.value)}
                                            className="w-full bg-transparent text-xs sm:text-sm font-black text-yellow-400 text-center outline-none px-2 py-1.5 sm:py-2"
                                            placeholder="..."
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto h-[60px] sm:h-[70px] bg-[#050505] border-t-2 border-orange-600/50 p-2 sm:p-3 shrink-0 z-50 shadow-[0_-5px_20px_rgba(249,115,22,0.15)] md:shadow-none">
                    <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="w-full h-full bg-gradient-to-b from-orange-500 to-red-600 border-b-4 border-red-900 active:translate-y-1 active:border-b-0 text-white rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center justify-center gap-2 transition-all">
                        {isSubmitting ? 'ĐANG XỬ LÝ...' : <><Send size={16} strokeWidth={3}/> NỘP BÀI CHIẾN DỊCH</>}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 5px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ef4444; }
            `}</style>
        </div>
    );
}