import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle, XCircle, AlertTriangle, User, Trophy, ArrowLeft, Home, Zap, Shield, Target, EyeOff, Lock, AlertOctagon } from 'lucide-react';
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
  const [timeLeft, setTimeLeft] = useState(0); // Sẽ set theo quiz.duration
  const [violationCount, setViolationCount] = useState(0);
  const [isCheatDetected, setIsCheatDetected] = useState(false); // Hiệu ứng màn hình đỏ
  const MAX_VIOLATIONS = 3; // Giới hạn số lần vi phạm

  // Ref để tránh stale closure trong event listener
  const violationsRef = useRef(0);

  // 1. LOAD ĐỀ & TRỘN CÂU HỎI
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
          
          // Lấy thời gian từ cấu hình đề thi (Mặc định 45p nếu không có)
          const durationMinutes = data.duration || 45;
          setTimeLeft(durationMinutes * 60);

          // Trộn đề
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

  // 2. HỆ THỐNG CHỐNG GIAN LẬN (SENTRY MODE)
  useEffect(() => {
    if (loading || submitted) return;

    // Hàm xử lý khi phát hiện gian lận
    const handleViolation = (reason) => {
        if (submitted) return;
        
        violationsRef.current += 1;
        setViolationCount(violationsRef.current);
        setIsCheatDetected(true);
        
        // Tắt hiệu ứng đỏ sau 2s
        setTimeout(() => setIsCheatDetected(false), 2000);

        if (violationsRef.current >= MAX_VIOLATIONS) {
            alert(`⛔ BẠN ĐÃ VI PHẠM QUÁ ${MAX_VIOLATIONS} LẦN! HỆ THỐNG SẼ TỰ ĐỘNG NỘP BÀI.`);
            handleSubmit(true, "Gian lận quá giới hạn");
        } else {
            alert(`⚠️ CẢNH BÁO VI PHẠM (${violationsRef.current}/${MAX_VIOLATIONS}):\n${reason}\nNếu tiếp tục, bài thi sẽ bị hủy!`);
        }
    };

    // A. Phát hiện rời tab / Minimized window
    const handleVisibilityChange = () => {
        if (document.hidden) {
            handleViolation("Bạn đã rời khỏi màn hình làm bài!");
        }
    };

    // B. Phát hiện mất focus (Click ra ngoài window)
    const handleBlur = () => {
        // Chỉ cảnh báo nhẹ hoặc tính vi phạm tùy mức độ thầy muốn
        // Ở đây tôi tính là vi phạm để nghiêm ngặt
        handleViolation("Mất tập trung vào bài thi!");
    };

    // C. Chặn Chuột phải & Copy
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

  // 3. ĐỒNG HỒ ĐẾM NGƯỢC
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

  // 4. LOGIC LÀM BÀI & CHẤM ĐIỂM
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
    if (!autoSubmit && !confirm("Bạn chắc chắn muốn nộp bài?")) return;
    
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
            violations: violationCount, // Lưu số lần vi phạm
            submitReason: reason, // Lưu lý do nộp (Hết giờ/Gian lận/Chủ động)
            submittedAt: serverTimestamp()
        });
    } catch (e) { console.error("Lỗi lưu điểm", e); }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white"><div className="animate-spin mr-3">⌛</div> Đang tải dữ liệu chiến trường...</div>;

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-orange-500 selection:text-white pb-20 transition-colors duration-300 ${isCheatDetected ? 'bg-red-900/50' : ''}`}>
      
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
      <div className="fixed top-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur border-b border-white/10 z-50 px-4 py-3 shadow-2xl flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white border-2 border-white/20">
                <User size={20}/>
            </div>
            <div>
                <h2 className="font-bold text-white uppercase text-sm leading-tight">{name}</h2>
                <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>{className}</span> • <span>{dob}</span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-4">
            {/* CẢNH BÁO VI PHẠM */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 font-black text-sm uppercase ${violationCount > 0 ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                <EyeOff size={16}/> 
                <span>Vi phạm: {violationCount}/{MAX_VIOLATIONS}</span>
            </div>

            {/* ĐỒNG HỒ */}
            {!submitted ? (
                <div className={`px-4 py-1.5 rounded-full border-2 font-mono font-bold text-lg flex items-center gap-2 ${timeLeft < 300 ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-emerald-500/10 border-emerald-500 text-emerald-400'}`}>
                    <Clock size={18}/> {formatTime(timeLeft)}
                </div>
            ) : (
                <div className="bg-yellow-500/20 text-yellow-400 px-4 py-1.5 rounded-full border border-yellow-500/50 font-black uppercase text-sm flex items-center gap-2">
                    <Trophy size={16}/> Đã hoàn thành
                </div>
            )}
        </div>
      </div>

      {/* --- NỘI DUNG CHÍNH --- */}
      <main className="max-w-3xl mx-auto mt-24 px-4 space-y-8 select-none"> {/* select-none: Chặn bôi đen text */}
        
        {/* TIÊU ĐỀ ĐỀ THI */}
        <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">{quiz?.title}</h1>
            <div className="inline-flex gap-2">
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase">P1: {quiz?.scoreConfig?.p1 || 6}đ</span>
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase">P2: GDPT</span>
                <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase">P3: {quiz?.scoreConfig?.p3 || 1}đ</span>
            </div>
        </div>

        {/* RENDER CÂU HỎI */}
        {questions.map((q, index) => {
            // Kiểm tra kết quả (cho Review Mode)
            const isQCorrect = submitted && scoreData.detail.find(d => d.qId === q.id)?.isCorrect;
            const earnedPoints = submitted ? scoreData.detail.find(d => d.qId === q.id)?.earned : 0;

            return (
            <div key={q.id} className={`relative bg-[#1e293b] rounded-2xl border-2 overflow-hidden transition-all ${
                submitted 
                ? (isQCorrect ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]') 
                : 'border-white/10 hover:border-indigo-500/50'
            }`}>
                {/* Header Câu Hỏi */}
                <div className="bg-slate-800/50 px-5 py-3 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className={`text-xs font-black px-2 py-1 rounded uppercase ${
                            q.type === 'MCQ' ? 'bg-blue-600 text-white' : 
                            q.type === 'TF' ? 'bg-orange-600 text-white' : 'bg-purple-600 text-white'
                        }`}>
                            {q.type === 'MCQ' ? 'P1' : q.type === 'TF' ? 'P2' : 'P3'} - Câu {index + 1}
                        </span>
                        {submitted && <span className="text-xs font-bold text-yellow-400">+{parseFloat(earnedPoints).toFixed(2)}đ</span>}
                    </div>
                </div>

                <div className="p-5">
                    {/* Nội dung câu hỏi */}
                    <div className="mb-4">
                        {q.img && <img src={q.img} className="max-h-60 w-auto rounded-lg mb-3 border border-white/10" />}
                        <h3 className="text-lg font-bold text-white leading-relaxed whitespace-pre-line">{q.q}</h3>
                    </div>

                    {/* --- P1: TRẮC NGHIỆM --- */}
                    {q.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.a.map((ans, aIdx) => {
                                const isSelected = answers[q.id] == aIdx;
                                const isCorrectAns = q.correct == aIdx;
                                
                                let btnClass = "border-2 border-slate-700 bg-slate-800/50 hover:bg-slate-700";
                                if (submitted) {
                                    if (isCorrectAns) btnClass = "border-green-500 bg-green-500/20 text-green-400"; // Đáp án đúng
                                    else if (isSelected && !isCorrectAns) btnClass = "border-red-500 bg-red-500/20 text-red-400"; // Chọn sai
                                    else btnClass = "border-slate-700 opacity-50"; // Không chọn
                                } else {
                                    if (isSelected) btnClass = "border-indigo-500 bg-indigo-600 text-white shadow-lg transform scale-[1.02]";
                                }

                                return (
                                    <button 
                                        key={aIdx} 
                                        onClick={() => handleAnswer(q.id, aIdx)}
                                        disabled={submitted}
                                        className={`p-4 rounded-xl text-left font-bold transition-all flex flex-col gap-2 ${btnClass}`}
                                    >   
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] shrink-0 font-black uppercase">
                                                {String.fromCharCode(65 + aIdx)}
                                            </div>
                                            <span>{ans}</span>
                                        </div>
                                        {q.aImages?.[aIdx] && <img src={q.aImages[aIdx]} className="h-24 w-auto rounded object-cover mt-1" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* --- P2: ĐÚNG / SAI --- */}
                    {q.type === 'TF' && (
                        <div className="border border-white/10 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900 text-slate-400 uppercase font-black text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Nội dung</th>
                                        <th className="px-2 py-3 text-center w-16">Đúng</th>
                                        <th className="px-2 py-3 text-center w-16">Sai</th>
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
                                                <td className="px-4 py-3 font-medium text-slate-200">
                                                    <span className="font-bold text-slate-500 mr-2">{String.fromCharCode(97+idx)})</span>
                                                    {item.text}
                                                </td>
                                                <td className="text-center">
                                                    <button 
                                                        onClick={() => handleAnswer(q.id, "true", idx)}
                                                        disabled={submitted}
                                                        className={`w-6 h-6 rounded border-2 transition-all ${
                                                            userChoice === "true" ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                                                        } ${submitted && item.isTrue === true ? 'ring-2 ring-green-400' : ''}`} 
                                                    >
                                                        {userChoice === "true" && <CheckCircle size={14} className="text-white mx-auto"/>}
                                                    </button>
                                                </td>
                                                <td className="text-center">
                                                    <button 
                                                        onClick={() => handleAnswer(q.id, "false", idx)}
                                                        disabled={submitted}
                                                        className={`w-6 h-6 rounded border-2 transition-all ${
                                                            userChoice === "false" ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                                                        } ${submitted && item.isTrue === false ? 'ring-2 ring-green-400' : ''}`}
                                                    >
                                                        {userChoice === "false" && <CheckCircle size={14} className="text-white mx-auto"/>}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* --- P3: TRẢ LỜI NGẮN --- */}
                    {q.type === 'SA' && (
                        <div>
                            <input 
                                type="text" 
                                className={`w-full bg-[#0f172a] border-2 p-4 rounded-xl outline-none font-bold text-lg placeholder-slate-600 ${
                                    submitted 
                                    ? (isQCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400')
                                    : 'border-slate-700 focus:border-indigo-500 text-white'
                                }`}
                                placeholder="Nhập câu trả lời của bạn..."
                                value={answers[q.id] || ''}
                                onChange={(e) => handleAnswer(q.id, e.target.value)}
                                disabled={submitted}
                            />
                            {submitted && !isQCorrect && (
                                <div className="mt-2 text-sm font-bold text-green-400 flex items-center gap-2 animate-pulse">
                                    <Target size={16}/> Đáp án đúng: {q.correct}
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#020617]/90 backdrop-blur border-t border-white/10 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-4">
            {!submitted ? (
                <button 
                    onClick={() => handleSubmit(false, "Nộp chủ động")}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-4 rounded-2xl font-black text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Zap fill="currentColor" /> NỘP BÀI CHIẾN ĐẤU
                </button>
            ) : (
                <div className="w-full flex gap-3 animate-in slide-in-from-bottom-10">
                    <div className="flex-1 bg-slate-800 text-white py-3 rounded-2xl flex flex-col items-center justify-center border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng điểm</span>
                        <span className={`text-3xl font-black ${scoreData.score >= 5 ? 'text-green-400' : 'text-red-400'}`}>{scoreData.score}</span>
                    </div>
                    <button 
                        onClick={() => router.push('/')}
                        className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Home size={20}/> Về trung tâm chỉ huy
                    </button>
                </div>
            )}
        </div>
      </div>

    </div>
  );
}