import { useState } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, BookOpen, User, ArrowRight, Shield, Zap, Gamepad2, Hash, Calendar, Users } from 'lucide-react';

export default function ExamLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Nhập Mã, 2: Nhập Tên
  
  // Dữ liệu
  const [examCode, setExamCode] = useState('');
  const [foundQuiz, setFoundQuiz] = useState(null);
  const [studentInfo, setStudentInfo] = useState({ name: '', dob: '', class: '' });

  // BƯỚC 1: KIỂM TRA MÃ ĐỀ
  const handleCheckCode = async (e) => {
      e.preventDefault();
      if (!examCode.trim()) return alert("Vui lòng nhập mã đề thi!");
      
      setLoading(true);
      try {
          // Tìm đề có mã trùng khớp và đang MỞ THI
          const q = query(
              collection(firestore, "quizzes"), 
              where("code", "==", examCode.trim()),
              where("isExamActive", "==", true)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
              const quizData = { id: snap.docs[0].id, ...snap.docs[0].data() };
              setFoundQuiz(quizData);
              
              // [TỰ ĐỘNG LẤY LỚP TỪ ĐỀ THI]
              setStudentInfo(prev => ({
                  ...prev,
                  class: quizData.assignedClass || 'Tự do' // Lấy lớp đã gán cho đề
              }));
              
              setStep(2);
          } else {
              alert("❌ Mã đề không tồn tại hoặc chưa được mở thi!");
          }
      } catch (err) {
          console.error(err);
          alert("Lỗi kết nối!");
      } finally {
          setLoading(false);
      }
  };

  // BƯỚC 2: VÀO THI
  const handleStartExam = () => {
      if (!studentInfo.name || !studentInfo.dob) {
          return alert("Vui lòng nhập họ tên và ngày sinh!");
      }
      router.push({
          pathname: `/exam/${foundQuiz.id}`,
          query: { 
              name: studentInfo.name, 
              dob: studentInfo.dob, 
              class: studentInfo.class 
          }
      });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_70%)] pointer-events-none"></div>
      
      <div className="bg-[#1e293b]/90 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-white/10 relative z-10 animate-in fade-in zoom-in duration-300">
        
        {/* LOGO */}
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg mb-4">
                <Gamepad2 size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2 drop-shadow-lg">
                Arena <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">Exam Online</span>
            </h1>
            <p className="text-indigo-300 font-medium text-sm tracking-wide uppercase">Hệ thống thi đấu trực tuyến</p>
        </div>

        {/* --- STEP 1: NHẬP MÃ --- */}
        {step === 1 && (
            <form onSubmit={handleCheckCode} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Nhập Mã Đề Thi (4 số)</label>
                    <div className="relative group">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors" size={24}/>
                        <input 
                            className="w-full bg-[#0f172a] border-2 border-slate-700 text-white text-center text-3xl p-4 rounded-xl outline-none focus:border-orange-500 font-black tracking-[0.5em] transition-all placeholder:tracking-normal placeholder:text-lg placeholder:font-normal"
                            placeholder="0000"
                            maxLength={4}
                            value={examCode}
                            onChange={(e) => setExamCode(e.target.value.replace(/[^0-9]/g, ''))}
                            autoFocus
                        />
                    </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-4 rounded-xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase italic disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin"/> : <Zap fill="currentColor"/>} KIỂM TRA MÃ
                </button>
            </form>
        )}

        {/* --- STEP 2: NHẬP THÔNG TIN (ĐÃ BỎ CHỌN LỚP) --- */}
        {step === 2 && foundQuiz && (
            <div className="space-y-5 animate-in slide-in-from-right-8">
                <div className="bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30 text-center">
                    <p className="text-xs font-bold text-indigo-300 uppercase mb-1">Đề thi xác nhận:</p>
                    <h3 className="text-xl font-black text-white uppercase italic">{foundQuiz.title}</h3>
                    <button onClick={() => setStep(1)} className="text-[10px] text-red-400 underline mt-2 hover:text-red-300">Nhập mã khác</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Họ tên chiến binh</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input className="w-full bg-[#0f172a] border-2 border-slate-700 text-white p-3 pl-12 rounded-xl outline-none focus:border-indigo-500 font-bold uppercase" placeholder="NGUYỄN VĂN A" value={studentInfo.name} onChange={(e) => setStudentInfo({...studentInfo, name: e.target.value})} autoFocus/>
                        </div>
                    </div>
                    
                    {/* [ĐÃ SỬA] HIỂN THỊ LỚP TỰ ĐỘNG (KHÔNG CHO CHỌN) */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Đơn vị (Lớp)</label>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                            <div className="w-full bg-slate-800/50 border-2 border-slate-700 text-slate-300 p-3 pl-10 rounded-xl font-bold cursor-not-allowed truncate">
                                {studentInfo.class}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Ngày sinh</label>
                        <div className="relative">
                            <input type="text" className="w-full bg-[#0f172a] border-2 border-slate-700 text-white p-3 rounded-xl outline-none focus:border-indigo-500 font-bold text-center appearance-none" value={studentInfo.dob} onChange={(e) => setStudentInfo({...studentInfo, dob: e.target.value})}/>
                        </div>
                    </div>
                </div>

                <button onClick={handleStartExam} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-4 rounded-xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase italic hover:scale-[1.02] active:scale-[0.98]">
                    <Zap fill="currentColor" /> BẮT ĐẦU CHIẾN ĐẤU <ArrowRight size={24} strokeWidth={3}/>
                </button>
            </div>
        )}
<button onClick={() => router.push('/')} className="mt-8 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest border-b border-transparent hover:border-white transition pb-1">
            Quay lại trang chủ
        </button>
      </div>
    </div>
  );
}