import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle, XCircle, AlertTriangle, User, Trophy, ArrowLeft, Home, Zap, Shield, Target, EyeOff, Lock, AlertOctagon, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ExamRoom() {
  const router = useRouter();
  const { id, name, dob, class: className } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState({ score: 0, detail: [] });
  
  // State Thời gian & Gian lận
  const [timeLeft, setTimeLeft] = useState(0); 
  const [violationCount, setViolationCount] = useState(0);
  const [isCheatDetected, setIsCheatDetected] = useState(false); 
  const MAX_VIOLATIONS = 3; 

  const violationsRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const lastViolationTimeRef = useRef(0);

  // 1. LOAD ĐỀ
  useEffect(() => {
    if (!id) return;
    const fetchExam = async () => {
      try {
        const docSnap = await getDoc(doc(firestore, "quizzes", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status !== 'OPEN') {
             alert("Đề thi này đã đóng!");
             router.push('/exam');
             return;
          }
          
          setQuiz(data);
          const durationMinutes = data.duration || 45;
          setTimeLeft(durationMinutes * 60);

          const p1 = data.questions.filter(q => q.type === 'MCQ').sort(() => Math.random() - 0.5);
          const p2 = data.questions.filter(q => q.type === 'TF').sort(() => Math.random() - 0.5);
          const p3 = data.questions.filter(q => q.type === 'SA').sort(() => Math.random() - 0.5);
          
          setQuestions([...p1, ...p2, ...p3]);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExam();
  }, [id]);

  // 2. CHỐNG GIAN LẬN
  useEffect(() => {
    if (loading || submitted) return;

    const handleViolation = (reason) => {
        if (submitted || isSubmittingRef.current) return;

        const now = Date.now();
        if (now - lastViolationTimeRef.current < 3000) return;

        lastViolationTimeRef.current = now;
        
        violationsRef.current += 1;
        setViolationCount(violationsRef.current);
        setIsCheatDetected(true);
        setTimeout(() => setIsCheatDetected(false), 2000);

        if (violationsRef.current >= MAX_VIOLATIONS) {
            alert(`⛔ VI PHẠM QUÁ ${MAX_VIOLATIONS} LẦN! TỰ ĐỘNG NỘP BÀI.`);
            handleSubmit(true, "Gian lận quá giới hạn");
        } else {
            alert(`⚠️ CẢNH BÁO (${violationsRef.current}/${MAX_VIOLATIONS}): ${reason}`);
        }
    };

    const handleVisibilityChange = () => { if (document.hidden) handleViolation("Rời màn hình!"); };
    const handleBlur = () => { handleViolation("Mất tập trung!"); };
    const preventCopy = (e) => { e.preventDefault(); return false; };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", preventCopy);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("paste", preventCopy);
    document.addEventListener("cut", preventCopy);

    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", handleBlur);
        document.removeEventListener("contextmenu", preventCopy);
        document.removeEventListener("copy", preventCopy);
        document.removeEventListener("paste", preventCopy);
        document.removeEventListener("cut", preventCopy);
    };
  }, [loading, submitted]);

  // 3. ĐỒNG HỒ
  useEffect(() => {
    if (loading || submitted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(true, "Hết giờ làm bài"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, submitted, timeLeft]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // 4. LOGIC
  const handleAnswer = (qId, value, subIndex = null) => {
    if (submitted) return;
    setAnswers(prev => {
      if (subIndex !== null) {
        const currentGroup = prev[qId] || {};
        return { ...prev, [qId]: { ...currentGroup, [subIndex]: value } };
      }
      return { ...prev, [qId]: value };
    });
  };

  const calculateScore = () => {
    let totalScore = 0;
    const detail = [];
    const config = quiz.scoreConfig || { p1: 6, p3: 1 }; 

    const p1Count = questions.filter(q => q.type === 'MCQ').length;
    const p3Count = questions.filter(q => q.type === 'SA').length;
    
    const scorePerP1 = p1Count > 0 ? (config.p1 / p1Count) : 0;
    const scorePerP3 = p3Count > 0 ? (config.p3 / p3Count) : 0;

    questions.forEach(q => {
        let earned = 0;
        let isCorrect = false;

        if (q.type === 'MCQ') {
            if (answers[q.id] == q.correct) { 
                earned = scorePerP1;
                isCorrect = true;
            }
        }
        else if (q.type === 'TF') {
            let correctCount = 0;
            const userAns = answers[q.id] || {};
            q.items.forEach((item, idx) => {
                if (String(userAns[idx]) === String(item.isTrue)) correctCount++;
            });
            if (correctCount === 1) earned = 0.1;
            else if (correctCount === 2) earned = 0.25;
            else if (correctCount === 3) earned = 0.5;
            else if (correctCount === 4) { earned = 1.0; isCorrect = true; }
        }
        else if (q.type === 'SA') {
            const userText = String(answers[q.id] || "").trim().toLowerCase();
            const correctText = String(q.correct || "").trim().toLowerCase();
            if (userText && userText === correctText) {
                earned = scorePerP3;
                isCorrect = true;
            }
        }
        totalScore += earned;
        detail.push({ qId: q.id, earned, isCorrect });
    });

    return { totalScore: Math.min(10, totalScore.toFixed(2)), detail }; 
  };

  const handleSubmit = async (autoSubmit = false, reason = "Nộp chủ động") => {
    isSubmittingRef.current = true;

    if (!autoSubmit) {
        if (!confirm("Bạn chắc chắn muốn nộp bài?")) {
            setTimeout(() => { isSubmittingRef.current = false; }, 500);
            return;
        }
    }
    
    const result = calculateScore();
    setScoreData({ score: result.totalScore, detail: result.detail });
    setSubmitted(true);

    if (result.totalScore >= 5 && violationCount < MAX_VIOLATIONS) {
        const duration = 3000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }

    try {
        await addDoc(collection(firestore, "exam_results"), {
            examId: id,
            studentName: name,
            studentDob: dob,
            studentClass: className,
            score: result.totalScore,
            answers: answers, 
            detail: result.detail,
            violations: violationCount, 
            submitReason: reason, 
            submittedAt: serverTimestamp()
        });
    } catch (e) { console.error("Lỗi lưu điểm", e); }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white"><div className="animate-spin mr-3">⌛</div> Đang tải dữ liệu chiến trường...</div>;

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-orange-500 selection:text-white pb-24 transition-colors duration-300 ${isCheatDetected ? 'bg-red-900/50' : ''}`}>
      
      {/* --- MÀN HÌNH CẢNH BÁO CHEAT --- */}
      {isCheatDetected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-600/90 backdrop-blur-sm animate-pulse">
              <div className="text-center text-white">
                  <AlertOctagon size={100} className="mx-auto mb-4"/>
                  <h1 className="text-5xl font-black uppercase">CẢNH BÁO GIAN LẬN!</h1>
                  <p className="text-2xl mt-2 font-bold">Quay lại bài làm ngay lập tức!</p>
              </div>
          </div>
      )}

      {/* --- HEADER STICKY --- */}
      <div className="fixed top-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur border-b border-white/10 z-50 px-3 md:px-4 py-2 shadow-2xl flex justify-between items-center h-16">
        
        {/* LEFT: LOGO */}
        <div className="flex items-center gap-2">
            <div className="bg-orange-600 p-1.5 rounded-lg shadow-[0_0_15px_#ea580c] animate-pulse">
                <Flame size={20} className="text-yellow-300" fill="currentColor"/>
            </div>
            <h1 className="hidden md:block text-xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 drop-shadow-[0_2px_2px_rgba(220,38,38,0.8)] leading-none">
                ARENA THI ONLINE
            </h1>
        </div>

        {/* CENTER: THÔNG TIN HỌC SINH (NGÀY SINH LÊN ĐÂY) */}
        <div className="flex items-center gap-3 bg-slate-800/60 border border-white/10 px-3 py-1 rounded-full mx-2 flex-1 md:flex-none justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white border border-white/20 shrink-0">
                <User size={16}/>
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-white uppercase text-xs md:text-sm leading-none truncate max-w-[120px] md:max-w-[200px]">{name}</span>
                {/* [THAY ĐỔI] Hiển thị Ngày sinh ở đây */}
                <span className="text-[10px] text-slate-400 font-mono leading-tight">{dob}</span>
            </div>
        </div>

        {/* RIGHT: CÔNG CỤ */}
        <div className="flex items-center gap-2">
            <div className={`flex items-center px-2 py-1 rounded-lg border text-xs font-bold ${violationCount > 0 ? 'bg-red-500 text-white border-red-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                <EyeOff size={14} className="md:mr-1"/> 
                <span>{violationCount}/{MAX_VIOLATIONS}</span>
            </div>

            {!submitted ? (
                <div className={`px-2 md:px-3 py-1 rounded-lg border font-mono font-bold text-sm md:text-base flex items-center gap-1 ${timeLeft < 300 ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-emerald-500/10 border-emerald-500 text-emerald-400'}`}>
                    <Clock size={16}/> {formatTime(timeLeft)}
                </div>
            ) : (
                <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg border border-yellow-500/50 font-bold text-xs uppercase flex items-center gap-1">
                    <Trophy size={14}/>
                </div>
            )}
        </div>
      </div>

      {/* --- NỘI DUNG CHÍNH --- */}
      <main className="max-w-4xl mx-auto mt-20 px-3 md:px-4 space-y-6 md:space-y-8 select-none"> 
        
        {/* TIÊU ĐỀ ĐỀ THI */}
        <div className="text-center mb-6">
            <h1 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">{quiz?.title}</h1>
            <div className="inline-flex gap-2 text-[10px] font-bold">
                <span className="bg-indigo-600 text-white px-2 py-1 rounded uppercase">Mã đề: {quiz?.code}</span>
                {/* [THAY ĐỔI] Hiển thị Lớp ở đây */}
                <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded uppercase">Lớp: {className}</span>
            </div>
        </div>

        {/* RENDER CÂU HỎI */}
        {questions.map((q, index) => {
            const isQCorrect = submitted && scoreData.detail.find(d => d.qId === q.id)?.isCorrect;
            const earnedPoints = submitted ? scoreData.detail.find(d => d.qId === q.id)?.earned : 0;

            return (
            <div key={q.id} className={`relative bg-[#1e293b] rounded-xl md:rounded-2xl border-2 overflow-hidden transition-all ${
                submitted 
                ? (isQCorrect ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]') 
                : 'border-white/10 hover:border-indigo-500/50'
            }`}>
                <div className="bg-slate-800/50 px-4 py-2 md:px-5 md:py-3 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] md:text-xs font-black px-2 py-1 rounded uppercase ${
                            q.type === 'MCQ' ? 'bg-blue-600 text-white' : 
                            q.type === 'TF' ? 'bg-orange-600 text-white' : 'bg-purple-600 text-white'
                        }`}>
                            {q.type === 'MCQ' ? 'P1' : q.type === 'TF' ? 'P2' : 'P3'} - Câu {index + 1}
                        </span>
                        {submitted && <span className="text-xs font-bold text-yellow-400">+{parseFloat(earnedPoints).toFixed(2)}đ</span>}
                    </div>
                </div>

                <div className="p-3 md:p-5">
                    <div className="mb-4">
                        {q.img && <img src={q.img} className="max-h-40 md:max-h-60 w-auto rounded-lg mb-3 border border-white/10 object-contain bg-black/30" />}
                        <h3 className="text-base md:text-lg font-bold text-white leading-relaxed whitespace-pre-line">{q.q}</h3>
                    </div>

                    {q.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.a.map((ans, aIdx) => {
                                const isSelected = answers[q.id] == aIdx;
                                const isCorrectAns = q.correct == aIdx;
                                
                                let btnClass = "border-2 border-slate-700 bg-slate-800/50 hover:bg-slate-700";
                                if (submitted) {
                                    if (isCorrectAns) btnClass = "border-green-500 bg-green-500/20 text-green-400";
                                    else if (isSelected && !isCorrectAns) btnClass = "border-red-500 bg-red-500/20 text-red-400"; 
                                    else btnClass = "border-slate-700 opacity-50"; 
                                } else {
                                    if (isSelected) btnClass = "border-indigo-500 bg-indigo-600 text-white shadow-lg transform scale-[1.01]";
                                }

                                return (
                                    <button 
                                        key={aIdx} 
                                        onClick={() => handleAnswer(q.id, aIdx)}
                                        disabled={submitted}
                                        className={`p-3 md:p-4 rounded-xl text-left font-bold transition-all flex flex-col gap-2 ${btnClass} active:scale-95 touch-manipulation`}
                                    >   
                                        <div className="flex items-start gap-3">
                                            <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] shrink-0 font-black uppercase mt-0.5">
                                                {String.fromCharCode(65 + aIdx)}
                                            </div>
                                            <span className="text-sm md:text-base leading-tight">{ans}</span>
                                        </div>
                                        {q.aImages?.[aIdx] && <img src={q.aImages[aIdx]} className="h-20 md:h-24 w-auto rounded object-cover mt-1 self-start" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {q.type === 'TF' && (
                        <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-[300px]">
                                <thead className="bg-slate-900 text-slate-400 uppercase font-black text-[10px] md:text-xs">
                                    <tr>
                                        <th className="px-3 py-3">Nội dung</th>
                                        <th className="px-2 py-3 text-center w-12 md:w-16">Đúng</th>
                                        <th className="px-2 py-3 text-center w-12 md:w-16">Sai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {q.items.map((item, idx) => {
                                        const userChoice = answers[q.id]?.[idx]; 
                                        const trueKey = String(item.isTrue);
                                        const isRowCorrect = String(userChoice) === trueKey;
                                        let rowClass = "hover:bg-white/5";
                                        if (submitted) rowClass = isRowCorrect ? "bg-green-500/10" : "bg-red-500/10";

                                        return (
                                            <tr key={idx} className={rowClass}>
                                                <td className="px-3 py-3 font-medium text-slate-200 text-xs md:text-sm">
                                                    <span className="font-bold text-slate-500 mr-2">{String.fromCharCode(97+idx)})</span>
                                                    {item.text}
                                                </td>
                                                <td className="text-center px-1">
                                                    <button onClick={() => handleAnswer(q.id, "true", idx)} disabled={submitted} className={`w-6 h-6 md:w-8 md:h-8 rounded border-2 transition-all inline-flex items-center justify-center touch-manipulation ${userChoice === "true" ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'} ${submitted && item.isTrue === true ? 'ring-2 ring-green-400' : ''}`}>{userChoice === "true" && <CheckCircle size={14} className="text-white"/>}</button>
                                                </td>
                                                <td className="text-center px-1">
                                                    <button onClick={() => handleAnswer(q.id, "false", idx)} disabled={submitted} className={`w-6 h-6 md:w-8 md:h-8 rounded border-2 transition-all inline-flex items-center justify-center touch-manipulation ${userChoice === "false" ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'} ${submitted && item.isTrue === false ? 'ring-2 ring-green-400' : ''}`}>{userChoice === "false" && <CheckCircle size={14} className="text-white"/>}</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {q.type === 'SA' && (
                        <div>
                            <input type="text" className={`w-full bg-[#0f172a] border-2 p-3 md:p-4 rounded-xl outline-none font-bold text-base md:text-lg placeholder-slate-600 uppercase ${submitted ? (isQCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400') : 'border-slate-700 focus:border-indigo-500 text-white'}`} placeholder="NHẬP ĐÁP ÁN..." value={answers[q.id] || ''} onChange={(e) => handleAnswer(q.id, e.target.value)} disabled={submitted} />
                            {submitted && !isQCorrect && (<div className="mt-2 text-sm font-bold text-green-400 flex items-center gap-2 animate-pulse"><Target size={16}/> Đáp án đúng: {q.correct}</div>)}
                        </div>
                    )}
                </div>
            </div>
            );
        })}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-3 md:p-4 bg-[#020617]/90 backdrop-blur border-t border-white/10 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-4">
            {!submitted ? (
                <button onClick={() => handleSubmit(false, "Nộp chủ động")} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-lg md:text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] transition-all touch-manipulation">
                    <Zap fill="currentColor" /> NỘP BÀI CHIẾN ĐẤU
                </button>
            ) : (
                <div className="w-full flex gap-3 animate-in slide-in-from-bottom-10">
                    <div className="flex-1 bg-slate-800 text-white py-3 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng điểm</span>
                        <span className={`text-2xl md:text-3xl font-black ${scoreData.score >= 5 ? 'text-green-400' : 'text-red-400'}`}>{scoreData.score}</span>
                    </div>
                    <button onClick={() => router.push('/')} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl md:rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 shadow-lg touch-manipulation">
                        <Home size={20}/> Về trung tâm
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}