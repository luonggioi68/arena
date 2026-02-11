import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { Clock, CheckCircle, XCircle, User, Trophy, ArrowLeft, RotateCcw, Zap, EyeOff, Flame, AlertOctagon, Target, Home } from 'lucide-react';
import confetti from 'canvas-confetti';
import useAuthStore from '@/store/useAuthStore';
// [NEW] Import MathRender
import MathRender from '@/components/MathRender'; 

export default function ArcadeExamMode() {
  const router = useRouter();
  const { id } = router.query;
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

  // [NEW] HÀM RENDER VĂN BẢN KÈM ẢNH INLINE
  const renderWithInlineImage = (text, imgUrl) => {
    if (!text) return null;
    
    // Nếu có thẻ [img] và có link ảnh
    if (text.includes('[img]') && imgUrl) {
        const parts = text.split('[img]');
        return (
            <span>
                {parts.map((part, index) => (
                    <span key={index}>
                        <MathRender content={part} />
                        {/* Chèn ảnh vào giữa */}
                        {index < parts.length - 1 && (
                            <img 
                                src={imgUrl} 
                                className="inline-block align-middle mx-1 max-h-12 border rounded bg-white shadow-sm" 
                                alt="minh-hoa"
                            />
                        )}
                    </span>
                ))}
            </span>
        );
    }
    
    // Mặc định trả về text chứa công thức toán
    return <MathRender content={text} />;
  };

  // 1. LOAD ĐỀ THI
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

          // [UPDATE] Đảm bảo cấu trúc dữ liệu cho TF (nếu thiếu field img)
          const formatQuestions = (qs) => qs.map(q => {
             if(q.type === 'TF') {
                 return { ...q, items: q.items.map(i => ({...i, img: i.img || ''})) }
             }
             return q;
          });

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
            handleSubmit(true, "Vi phạm quá giới hạn");
        }
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

  // 3. ĐỒNG HỒ
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
        } catch (e) { 
            console.error("Lỗi lưu điểm:", e); 
        }
    }
  };

  const handleReturnToLobby = () => {
      const targetGrade = quiz?.grade || 10;
      router.push(`/training?grade=${targetGrade}`);
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white"><div className="animate-spin mr-3">⌛</div> Đang tải đề...</div>;

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-24 ${isCheatDetected ? 'bg-red-900/50' : ''}`}>
      {isCheatDetected && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-600/90 backdrop-blur-sm animate-pulse"><div className="text-center text-white"><AlertOctagon size={80} className="mx-auto mb-4"/><h1 className="text-4xl font-black uppercase">CẢNH BÁO TẬP TRUNG!</h1></div></div>)}

      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur border-b border-white/10 z-50 px-4 py-2 shadow-xl flex justify-between items-center h-16">
        <div className="flex items-center gap-2">
            <button onClick={handleReturnToLobby} className="p-2 hover:bg-white/10 rounded-full transition"><ArrowLeft size={20}/></button>
            <div className="hidden md:block bg-orange-600 p-1.5 rounded-lg"><Flame size={18} className="text-yellow-300" fill="currentColor"/></div>
            <h1 className="font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500 truncate max-w-[150px] md:max-w-none">{quiz?.title}</h1>
        </div>
        <div className="flex items-center gap-3">
            <div className={`flex items-center px-2 py-1 rounded border text-xs font-bold ${violationCount>0?'bg-red-500 text-white border-red-400':'bg-slate-800 text-slate-500 border-slate-700'}`}><EyeOff size={14} className="mr-1"/> {violationCount}/{MAX_VIOLATIONS}</div>
            {!submitted ? (<div className={`px-3 py-1 rounded border font-mono font-bold flex items-center gap-1 ${timeLeft < 300 ? 'bg-red-500/20 text-red-500 border-red-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500'}`}><Clock size={16}/> {formatTime(timeLeft)}</div>) : (<div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded border border-yellow-500 font-bold text-sm flex items-center gap-1"><Trophy size={16}/> {scoreData.score}đ</div>)}
        </div>
      </div>

      {/* BODY - Cập nhật Render */}
      <main className="max-w-3xl mx-auto mt-20 px-4 space-y-6 select-none">
        {questions.map((q, index) => {
            const isQCorrect = submitted && scoreData.detail.find(d => d.qId === q.id)?.isCorrect;
            return (
            <div key={q.id} className={`bg-[#1e293b] rounded-xl border-2 overflow-hidden ${submitted ? (isQCorrect ? 'border-green-500/50' : 'border-red-500/50') : 'border-white/10'}`}>
                {/* Số thứ tự câu hỏi */}
                <div className="bg-slate-800/50 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                    <span className="text-xs font-black bg-blue-600 text-white px-2 py-1 rounded uppercase">Câu {index + 1}</span>
                    {submitted && <span className={`text-xs font-bold uppercase ${isQCorrect ? 'text-green-400' : 'text-red-400'}`}>{isQCorrect ? "Chính xác" : "Chưa đúng"}</span>}
                </div>
                
                <div className="p-5">
                    {/* [UPDATED] Render Nội dung câu hỏi (Text trước - Ảnh sau) */}
                    <div className="flex gap-2 items-start mb-4">
                        <div className="text-lg text-slate-200 leading-relaxed w-full font-bold">
                             {renderWithInlineImage(q.q, q.img)}
                        </div>
                    </div>

                    {/* Hiển thị ảnh khối nếu không có thẻ [img] */}
                    {q.img && !q.q.includes('[img]') && (
                        <div className="w-full flex justify-center mb-4">
                            <img src={q.img} className="max-h-64 rounded-lg border border-white/10 shadow-sm bg-black/30 object-contain" />
                        </div>
                    )}
                    
                    {/* Render Đáp án */}
                    {q.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.a.map((ans, aIdx) => { 
                                const isSelected = answers[q.id] == aIdx; 
                                const isCorrectAns = q.correct == aIdx; 
                                let btnClass = "border-2 border-slate-700 bg-slate-800/50 hover:bg-slate-700/80"; 
                                if (submitted) { 
                                    if (isCorrectAns) btnClass = "border-green-500 bg-green-500/20 text-green-400"; 
                                    else if (isSelected) btnClass = "border-red-500 bg-red-500/20 text-red-400"; 
                                } else if (isSelected) btnClass = "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"; 
                                
                                return (
                                    <button key={aIdx} onClick={() => handleAnswer(q.id, aIdx)} disabled={submitted} className={`p-3 rounded-xl text-left flex items-start gap-3 transition-all ${btnClass}`}>
                                        <span className="font-bold pt-0.5">{String.fromCharCode(65 + aIdx)}.</span>
                                        <div className="flex-1 text-[17px] leading-snug pt-0.5">
                                            {renderWithInlineImage(ans, q.aImages?.[aIdx])}
                                            {/* Fallback ảnh khối cho đáp án */}
                                            {q.aImages?.[aIdx] && !ans.includes('[img]') && (
                                                <img src={q.aImages[aIdx]} className="h-20 w-auto mt-2 rounded bg-white p-1 object-contain"/>
                                            )}
                                        </div>
                                    </button>
                                ); 
                            })}
                        </div>
                    )}

                    {q.type === 'TF' && (
                        <div className="border border-white/10 rounded-xl overflow-hidden mt-2">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900 text-slate-400 uppercase font-black text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Nội dung</th>
                                        <th className="px-2 py-3 text-center w-16">Đúng</th>
                                        <th className="px-2 py-3 text-center w-16">Sai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(q.items || []).map((item, idx) => { 
                                        const userChoice = answers[q.id]?.[idx]; 
                                        return (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-[17px] text-slate-200 font-bold">
                                                    <div className="flex gap-2">
                                                        <span className="font-bold text-slate-500 text-sm font-sans">{String.fromCharCode(97 + idx)})</span>
                                                        <div className="flex-1">
                                                            {renderWithInlineImage(item.text, item.img)}
                                                            {/* Ảnh khối cho TF */}
                                                            {item.img && !item.text.includes('[img]') && (
                                                                <img src={item.img} className="h-16 mt-2 rounded border border-white/10 block object-contain"/>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-center align-middle">
                                                    <button onClick={() => handleAnswer(q.id, "true", idx)} disabled={submitted} className={`w-8 h-8 mx-auto rounded-lg border-2 flex items-center justify-center transition-all ${userChoice === "true" ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'border-slate-600 hover:border-slate-400'}`}>
                                                        {userChoice==="true" && <CheckCircle size={16}/>}
                                                    </button>
                                                </td>
                                                <td className="text-center align-middle">
                                                    <button onClick={() => handleAnswer(q.id, "false", idx)} disabled={submitted} className={`w-8 h-8 mx-auto rounded-lg border-2 flex items-center justify-center transition-all ${userChoice === "false" ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'border-slate-600 hover:border-slate-400'}`}>
                                                        {userChoice==="false" && <CheckCircle size={16}/>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ); 
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {q.type === 'SA' && (
                        <div className="mt-2 space-y-3">
                            <div className="text-sm italic text-slate-400">(Học sinh nhập đáp án ngắn gọn vào ô dưới đây)</div>
                            <input 
                                value={answers[q.id] || ''} 
                                onChange={(e) => handleAnswer(q.id, e.target.value)} 
                                disabled={submitted} 
                                className="w-full bg-[#0f172a] border-2 border-slate-700 p-4 rounded-xl outline-none font-bold text-xl uppercase focus:border-indigo-500 transition-colors" 
                                placeholder="NHẬP ĐÁP ÁN..." 
                            />
                            {submitted && (
                                <div className="p-3 bg-slate-800/50 rounded-lg border border-white/5 text-sm">
                                    <span className="text-slate-400 font-bold block mb-1">Đáp án đúng:</span>
                                    <div className="font-serif text-lg text-green-400 font-bold">
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

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#020617]/90 backdrop-blur border-t border-white/10 z-50">
        <div className="max-w-3xl mx-auto flex gap-4">
            {!submitted ? (
                <button onClick={() => handleSubmit(false)} className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 rounded-xl font-black text-lg shadow-lg uppercase italic flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                    <Zap fill="currentColor" /> NỘP BÀI NGAY
                </button>
            ) : (
                <div className="w-full flex gap-3 animate-in slide-in-from-bottom">
                    <div className="flex-1 bg-slate-800 text-white py-3 rounded-xl flex flex-col items-center justify-center border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng điểm</span>
                        <span className={`text-2xl font-black ${scoreData.score >= 5 ? 'text-green-400' : 'text-red-400'}`}>{scoreData.score}</span>
                    </div>
                    <button onClick={handleReturnToLobby} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all">
                        <Home size={20}/> Về sảnh
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}