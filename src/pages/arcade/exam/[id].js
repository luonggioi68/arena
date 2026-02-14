import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { Clock, CheckCircle, XCircle, Trophy, ArrowLeft, RotateCcw, Zap, EyeOff, Flame, Swords, ShieldAlert, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import useAuthStore from '@/store/useAuthStore';
import MathRender from '@/components/MathRender'; 

export default function ArcadeExamMode() {
  const router = useRouter();
  // Lấy 'source' từ URL (do Lobby truyền sang)
  const { id, source } = router.query; 
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState({ score: 0, detail: [] });
  
  const [timeLeft, setTimeLeft] = useState(0); 
  const [violationCount, setViolationCount] = useState(0);
  const [isCheatDetected, setIsCheatDetected] = useState(false); 
  const MAX_VIOLATIONS = 3; 

  const violationsRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const lastViolationTimeRef = useRef(0);

  // --- HÀM RENDER ---
  const renderWithInlineImage = (text, imgUrl) => {
    if (!text) return null;
    if (text.includes('[img]') && imgUrl) {
        const parts = text.split('[img]');
        return (
            <span>
                {parts.map((part, index) => (
                    <span key={index}>
                        <MathRender content={part} />
                        {index < parts.length - 1 && (
                            <img src={imgUrl} className="inline-block align-middle mx-1 max-h-12 border rounded bg-white shadow-sm" alt="minh-hoa"/>
                        )}
                    </span>
                ))}
            </span>
        );
    }
    return <MathRender content={text} />;
  };

  // --- LOAD DATA ---
  useEffect(() => {
    if (!id) return;
    const fetchExam = async () => {
      try {
        const docSnap = await getDoc(doc(firestore, "quizzes", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setQuiz(data);
          const durationMinutes = data.duration || 45;
          setTimeLeft(durationMinutes * 60);

          const formatQuestions = (qs) => qs.map(q => {
             if(q.type === 'TF') return { ...q, items: q.items.map(i => ({...i, img: i.img || ''})) }
             return q;
          });

          // Randomize questions
          const p1 = formatQuestions((data.questions || []).filter(q => q.type === 'MCQ')).sort(() => Math.random() - 0.5);
          const p2 = formatQuestions((data.questions || []).filter(q => q.type === 'TF')).sort(() => Math.random() - 0.5);
          const p3 = formatQuestions((data.questions || []).filter(q => q.type === 'SA')).sort(() => Math.random() - 0.5);
          setQuestions([...p1, ...p2, ...p3]);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExam();
  }, [id]);

  // --- CHỐNG GIAN LẬN ---
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

        if (violationsRef.current >= MAX_VIOLATIONS) handleSubmit(true, "Vi phạm quá giới hạn");
    };
    const handleVisibilityChange = () => { if (document.hidden) handleViolation("Rời màn hình"); };
    const preventCopy = (e) => { e.preventDefault(); return false; };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("paste", preventCopy);
    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        document.removeEventListener("copy", preventCopy);
        document.removeEventListener("paste", preventCopy);
    };
  }, [loading, submitted]);

  // --- TIMER ---
  useEffect(() => {
    if (loading || submitted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(true, "Hết giờ"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, submitted, timeLeft]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

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
            if (answers[q.id] == q.correct) { earned = scorePerP1; isCorrect = true; }
        } else if (q.type === 'TF') {
            let correctCount = 0;
            const userAns = answers[q.id] || {};
            (q.items || []).forEach((item, idx) => { if (String(userAns[idx]) === String(item.isTrue)) correctCount++; });
            if (correctCount === 4) { earned = 1.0; isCorrect = true; }
            else if (correctCount === 3) earned = 0.5;
            else if (correctCount === 2) earned = 0.25;
            else if (correctCount === 1) earned = 0.1;
        } else if (q.type === 'SA') {
            if (String(answers[q.id]||"").trim().toLowerCase() === String(q.correct||"").trim().toLowerCase()) { earned = scorePerP3; isCorrect = true; }
        }
        totalScore += earned;
        detail.push({ qId: q.id, earned, isCorrect });
    });
    return { totalScore: Math.min(10, parseFloat(totalScore.toFixed(2))), detail }; 
  };

  const handleSubmit = async (autoSubmit = false, reason = "Nộp chủ động") => {
    isSubmittingRef.current = true;
    if (!autoSubmit && !confirm("Nộp bài và xem điểm ngay?")) {
        setTimeout(() => { isSubmittingRef.current = false; }, 500);
        return;
    }
    
    const result = calculateScore();
    setScoreData({ score: result.totalScore, detail: result.detail });
    setSubmitted(true);

    if (result.totalScore >= 5) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

    if(user) {
        try {
            const earnedXP = Math.round(result.totalScore * 10); 
            const studentRef = doc(firestore, "student_profiles", user.uid);
            await setDoc(studentRef, {
                totalScore: increment(earnedXP),
                uid: user.uid,
                email: user.email || "",
                nickname: user.displayName || "Chiến binh mới",
                photoURL: user.photoURL || ""
            }, { merge: true });

            await addDoc(collection(firestore, "practice_results"), {
                examId: id,
                examTitle: quiz.title,
                studentId: user.uid,
                studentName: user.displayName || "Chiến binh",
                score: result.totalScore,
                violations: violationCount,
                submittedAt: serverTimestamp(),
                mode: 'ARCADE_EXAM'
            });
        } catch (e) { console.error("Lỗi lưu điểm:", e); }
    }
  };

  // [QUAN TRỌNG] LOGIC ĐIỀU HƯỚNG VỀ LOBBY
  const handleReturn = () => {
      // Luôn quay về trang Lobby (Sảnh chờ)
      // Kèm theo tham số 'from' để Lobby biết đường quay về Dashboard
      if (source) {
          router.push({
              pathname: `/arcade/lobby/${id}`,
              query: { from: source } 
          });
      } else {
          // Trường hợp không có source, về Lobby mặc định
          router.push(`/arcade/lobby/${id}`);
      }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white"><div className="animate-spin mr-3 text-orange-500">🔥</div> Đang triệu hồi đấu trường...</div>;

  return (
    <div className={`min-h-screen bg-[#050505] text-slate-200 font-sans pb-24 ${isCheatDetected ? 'bg-red-900/50' : ''}`}>
      
      {/* BACKGROUND HIỆU ỨNG CHÁY */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-red-900/20 to-transparent"></div>
          <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-orange-900/10 to-transparent"></div>
      </div>

      {/* CẢNH BÁO GIAN LẬN */}
      {isCheatDetected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-600/90 backdrop-blur-sm animate-pulse">
              <div className="text-center text-white">
                  <ShieldAlert size={80} className="mx-auto mb-4"/>
                  <h1 className="text-4xl font-black uppercase tracking-widest border-4 border-white p-4">CẢNH BÁO VI PHẠM!</h1>
              </div>
          </div>
      )}

      {/* --- HEADER RỰC LỬA --- */}
      <div className="fixed top-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-md border-b-2 border-red-600/60 z-50 px-4 h-16 shadow-[0_0_40px_rgba(220,38,38,0.5)] flex justify-between items-center">
        
        {/* LEFT: BACK & TITLE */}
        <div className="flex items-center gap-3">
            <button onClick={handleReturn} className="p-2 hover:bg-white/10 rounded-full transition text-orange-500 hover:text-white border border-transparent hover:border-orange-500 group">
                <ArrowLeft size={24} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform"/>
            </button>
            <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                    <Swords size={22} className="text-red-500 animate-pulse hidden md:block"/>
                    {/* TIÊU ĐỀ CHÁY */}
                    <h1 className="text-lg md:text-2xl font-black italic uppercase tracking-tighter fire-text leading-none drop-shadow-lg">
                        ARENA THI MÔ PHỎNG
                    </h1>
                </div>
                {/* Tên đề thi nhỏ bên dưới */}
                <span className="text-[9px] md:text-[10px] font-bold text-orange-400/80 uppercase tracking-widest truncate max-w-[180px] md:max-w-md border-t border-orange-500/30 pt-0.5 mt-0.5">
                    {quiz?.title || "Đang tải dữ liệu..."}
                </span>
            </div>
        </div>

        {/* RIGHT: STATS (VIOLATION & TIMER) */}
        <div className="flex items-center gap-3">
            {/* Vi phạm */}
            <div className={`hidden md:flex items-center px-3 py-1 rounded-lg border font-bold text-xs ${violationCount>0 ? 'bg-red-900/80 border-red-500 text-red-200 animate-pulse' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}>
                <EyeOff size={14} className="mr-1"/> {violationCount}/{MAX_VIOLATIONS}
            </div>
            
            {/* Đồng hồ / Điểm */}
            {!submitted ? (
                <div className={`px-3 md:px-4 py-1.5 rounded-lg border-2 font-mono font-black text-lg flex items-center gap-2 shadow-[0_0_15px_rgba(234,88,12,0.3)] ${timeLeft < 300 ? 'bg-red-900/60 border-red-500 text-red-400 animate-pulse' : 'bg-gradient-to-b from-orange-900/80 to-black border-orange-500 text-orange-400'}`}>
                    <Clock size={18} className="animate-spin-slow"/> {formatTime(timeLeft)}
                </div>
            ) : (
                <div className="bg-yellow-900/40 text-yellow-400 px-4 py-1.5 rounded-lg border-2 border-yellow-500 font-black text-lg flex items-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.4)] animate-bounce">
                    <Trophy size={18} fill="currentColor"/> {scoreData.score}
                </div>
            )}
        </div>
      </div>

      {/* --- BODY --- */}
      <main className="max-w-4xl mx-auto mt-24 px-4 space-y-6 select-none pb-28 relative z-10">
        {questions.map((q, index) => {
            const isQCorrect = submitted && scoreData.detail.find(d => d.qId === q.id)?.isCorrect;
            return (
            <div key={q.id} className={`bg-[#0f0f0f] rounded-2xl border-2 overflow-hidden relative group transition-all duration-300 ${submitted ? (isQCorrect ? 'border-green-600/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-red-600/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]') : 'border-slate-800 hover:border-orange-600/60 hover:shadow-[0_0_25px_rgba(234,88,12,0.15)]'}`}>
                
                {/* Header Câu hỏi */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-3 border-b border-white/5 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black bg-gradient-to-br from-orange-600 to-red-700 text-white px-3 py-1 rounded shadow-lg uppercase tracking-wider">Câu {index + 1}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Target size={12}/> {q.type === 'MCQ' ? 'Trắc nghiệm' : q.type === 'TF' ? 'Đúng/Sai' : 'Điền khuyết'}
                        </span>
                    </div>
                    {submitted && <span className={`text-xs font-black uppercase px-2 py-0.5 rounded border ${isQCorrect ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>{isQCorrect ? "CHÍNH XÁC" : "SAI RỒI"}</span>}
                </div>
                
                <div className="p-6 relative z-10">
                    {/* Nội dung câu hỏi */}
                    <div className="text-lg md:text-xl text-slate-200 leading-relaxed font-bold mb-6 overflow-x-auto break-words pb-2">
                          {renderWithInlineImage(q.q, q.img)}
                    </div>

                    {q.img && !q.q.includes('[img]') && (
                        <div className="w-full flex justify-center mb-6">
                            <img src={q.img} className="max-h-72 rounded-lg border-2 border-slate-700 shadow-xl bg-black object-contain" />
                        </div>
                    )}
                    
                    {/* Đáp án MCQ */}
                    {q.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.a.map((ans, aIdx) => { 
                                const isSelected = answers[q.id] == aIdx; 
                                const isCorrectAns = q.correct == aIdx; 
                                let btnClass = "border-2 border-slate-800 bg-slate-900/40 hover:bg-slate-800"; 
                                if (submitted) { 
                                    if (isCorrectAns) btnClass = "border-green-500 bg-green-900/20 text-green-400 shadow-[0_0_10px_green]"; 
                                    else if (isSelected) btnClass = "border-red-500 bg-red-900/20 text-red-400 opacity-60"; 
                                } else if (isSelected) btnClass = "border-orange-500 bg-orange-900/20 text-white shadow-[0_0_15px_orange] scale-[1.01]"; 
                                
                                return (
                                    <button key={aIdx} onClick={() => handleAnswer(q.id, aIdx)} disabled={submitted} className={`p-4 rounded-xl text-left flex items-start gap-3 transition-all ${btnClass}`}>
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-sm shrink-0 ${isSelected ? 'border-orange-500 bg-orange-500 text-black' : 'border-slate-600 text-slate-500'}`}>
                                            {String.fromCharCode(65 + aIdx)}
                                        </div>
                                       <div className="flex-1 text-[16px] font-medium pt-1 overflow-x-auto break-words">
    {renderWithInlineImage(ans, q.aImages?.[aIdx])}
    {q.aImages?.[aIdx] && !ans.includes('[img]') && <img src={q.aImages[aIdx]} className="h-20 w-auto mt-2 rounded border border-slate-600 block object-contain"/>}
</div>
                                    </button>
                                ); 
                            })}
                        </div>
                    )}

                    {/* Đáp án TF */}
                    {q.type === 'TF' && (
                        <div className="border border-slate-700 rounded-xl overflow-hidden mt-2 bg-black/40">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800 text-orange-500 uppercase font-black text-xs border-b border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3">Nội dung</th>
                                        <th className="px-2 py-3 text-center w-20 border-l border-slate-700 hover:bg-green-900/20 cursor-help" title="Chọn Đúng">Đúng</th>
                                        <th className="px-2 py-3 text-center w-20 border-l border-slate-700 hover:bg-red-900/20 cursor-help" title="Chọn Sai">Sai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {(q.items || []).map((item, idx) => { 
                                        const userChoice = answers[q.id]?.[idx]; 
                                        return (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-[16px] text-slate-300 font-bold">
                                                    <div className="flex gap-2">
                                                        <span className="font-bold text-orange-600/70">{String.fromCharCode(97 + idx)})</span>
                                                      <div className="flex-1 overflow-x-auto break-words w-full">
    {renderWithInlineImage(item.text, item.img)}
    {item.img && !item.text.includes('[img]') && <img src={item.img} className="h-16 mt-2 rounded border border-slate-600 block object-contain"/>}
</div>
                                                    </div>
                                                </td>
                                                <td className="text-center align-middle border-l border-slate-700">
                                                    <button onClick={() => handleAnswer(q.id, "true", idx)} disabled={submitted} className={`w-8 h-8 mx-auto rounded-md border-2 flex items-center justify-center transition-all ${userChoice === "true" ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'border-slate-600 hover:border-green-500'}`}>
                                                        {userChoice==="true" && <CheckCircle size={16}/>}
                                                    </button>
                                                </td>
                                                <td className="text-center align-middle border-l border-slate-700">
                                                    <button onClick={() => handleAnswer(q.id, "false", idx)} disabled={submitted} className={`w-8 h-8 mx-auto rounded-md border-2 flex items-center justify-center transition-all ${userChoice === "false" ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'border-slate-600 hover:border-red-500'}`}>
                                                        {userChoice==="false" && <XCircle size={16}/>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ); 
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Đáp án SA */}
                    {q.type === 'SA' && (
                        <div className="mt-2 space-y-3">
                            <div className="text-xs font-bold uppercase text-orange-500/70 tracking-widest mb-1 flex items-center gap-2"><Zap size={12}/> Nhập đáp án của bạn:</div>
                            <input 
                                value={answers[q.id] || ''} 
                                onChange={(e) => handleAnswer(q.id, e.target.value)} 
                                disabled={submitted} 
                                className="w-full bg-black/50 border-2 border-slate-700 p-4 rounded-xl outline-none font-black text-xl text-white focus:border-orange-500 focus:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all placeholder:text-slate-700 uppercase" 
                                placeholder="GÕ ĐÁP ÁN VÀO ĐÂY..." 
                            />
                            {submitted && (
                                <div className="p-4 bg-green-900/20 rounded-xl border border-green-500/30 text-sm flex gap-3 items-center shadow-inner">
                                    <span className="text-green-500 font-bold uppercase shrink-0">Đáp án đúng:</span>
                                    <div className="font-mono text-xl text-white font-bold tracking-wider">
                                        {renderWithInlineImage(q.correct)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            );
        })}
      </main>

      {/* --- FOOTER --- */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-[#050505] to-transparent z-40">
        <div className="max-w-2xl mx-auto flex gap-4">
            {!submitted ? (
                <button onClick={() => handleSubmit(false)} className="w-full bg-gradient-to-r from-orange-600 to-red-700 text-white py-4 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(234,88,12,0.5)] uppercase italic flex items-center justify-center gap-3 hover:scale-[1.02] hover:brightness-110 active:scale-95 transition-all border-2 border-orange-500 group">
                    <Zap fill="currentColor" size={24} className="group-hover:animate-pulse"/> NỘP BÀI NGAY
                </button>
            ) : (
                <div className="w-full flex gap-3 animate-in slide-in-from-bottom">
                    <div className="flex-1 bg-slate-900/90 text-white py-3 rounded-2xl flex flex-col items-center justify-center border-2 border-slate-700 shadow-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng điểm</span>
                        <span className={`text-3xl font-black ${scoreData.score >= 5 ? 'text-green-400' : 'text-red-500'}`}>{scoreData.score}</span>
                    </div>
                    <button onClick={handleReturn} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all border-2 border-indigo-400">
                        <RotateCcw size={20}/> Quay về sảnh
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* STYLE CSS */}
      <style jsx global>{`
        .fire-text {
            background: linear-gradient(0deg, #ff8a00 0%, #e52e71 50%, #ff0000 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 5px rgba(255, 0, 0, 0.8));
            animation: burn 1.5s infinite alternate;
        }
        @keyframes burn {
            0% { filter: drop-shadow(0 0 5px rgba(255, 69, 0, 0.6)); }
            100% { filter: drop-shadow(0 0 15px rgba(255, 0, 0, 1)); }
        }
      `}</style>
    </div>
  );
}