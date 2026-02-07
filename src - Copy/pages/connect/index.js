import { useState } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Shield, ArrowRight, MessageSquare, User, Loader2, Hash } from 'lucide-react';

export default function ConnectLobby() {
  const router = useRouter();
  
  const [step, setStep] = useState(1); // 1: Nhập Mã, 2: Nhập Tên
  const [pin, setPin] = useState('');
  const [foundBoard, setFoundBoard] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);

  // BƯỚC 1: KIỂM TRA MÃ
  const handleCheckPin = async (e) => {
      e.preventDefault();
      if (!pin.trim()) return alert("Vui lòng nhập mã PIN!");
      
      setLoading(true);
      try {
          // Tìm bảng có mã trùng khớp và đang MỞ
          const q = query(
              collection(firestore, "interactive_boards"),
              where("code", "==", pin.trim()),
              where("status", "==", "OPEN")
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
              setFoundBoard({ id: snap.docs[0].id, ...snap.docs[0].data() });
              setStep(2);
          } else {
              alert("❌ Mã không tồn tại hoặc chủ đề đã bị khóa!");
          }
      } catch (err) {
          console.error(err);
          alert("Lỗi kết nối!");
      } finally {
          setLoading(false);
      }
  };

  // BƯỚC 2: VÀO BẢNG
  const handleJoin = (e) => {
      e.preventDefault();
      if (!studentName.trim()) return alert("Vui lòng nhập tên!");
      
      router.push(`/connect/${foundBoard.id}?name=${encodeURIComponent(studentName)}`);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30 animate-pulse"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none"></div>

      <div className="bg-slate-900/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_0_60px_rgba(56,189,248,0.3)] w-full max-w-md text-center border-t-4 border-cyan-500 relative z-10 animate-in zoom-in duration-300">
        
        <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl">
             <MessageSquare size={40} className="text-white" fill="currentColor"/>
        </div>

        <h1 className="text-3xl font-black text-white mb-2 italic uppercase tracking-tighter">SẢNH TƯƠNG TÁC</h1>
        <p className="text-cyan-400 text-xs font-bold uppercase tracking-[0.3em] mb-8">Kết nối không gian thảo luận</p>
        
        {/* --- STEP 1: NHẬP MÃ --- */}
        {step === 1 && (
            <form onSubmit={handleCheckPin} className="space-y-6">
                <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={24}/>
                    <input 
                        className="w-full bg-slate-950 p-4 rounded-xl text-center font-black text-3xl text-white outline-none border-2 border-slate-800 focus:border-cyan-500 transition-all placeholder:text-slate-700 tracking-[0.5em] placeholder:tracking-normal placeholder:text-lg placeholder:font-bold" 
                        placeholder="0000"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                    />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-4 rounded-xl text-xl shadow-lg transition-all uppercase italic flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin"/> : <ArrowRight size={24}/>} TIẾP TỤC
                </button>
            </form>
        )}

        {/* --- STEP 2: NHẬP TÊN --- */}
        {step === 2 && foundBoard && (
            <form onSubmit={handleJoin} className="space-y-5 animate-in slide-in-from-right-8">
                <div className="bg-cyan-900/20 p-4 rounded-xl border border-cyan-500/30 text-center">
                    <p className="text-[10px] font-bold text-cyan-300 uppercase mb-1">Tham gia chủ đề:</p>
                    <h3 className="text-xl font-black text-white uppercase italic line-clamp-2">{foundBoard.title}</h3>
                    <button onClick={() => {setStep(1); setPin('')}} type="button" className="text-[10px] text-slate-400 underline mt-2 hover:text-white">Nhập mã khác</button>
                </div>

                <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors"/>
                    <input 
                        value={studentName} 
                        onChange={(e) => setStudentName(e.target.value)} 
                        className="w-full bg-slate-950 p-3.5 pl-12 rounded-xl text-left font-bold text-lg text-white outline-none border-2 border-slate-800 focus:border-cyan-500 transition-all placeholder:text-slate-600 placeholder:font-normal uppercase" 
                        placeholder="NHẬP TÊN CỦA BẠN..." 
                        autoFocus
                    />
                </div>
                
                <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-4 rounded-xl text-xl shadow-lg transition-all uppercase italic flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95">
                    Vào Ngay <ArrowRight size={24}/>
                </button>
            </form>
        )}

        <button onClick={() => router.push('/')} className="mt-8 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest border-b border-transparent hover:border-white transition pb-1">
            Quay lại trang chủ
        </button>
      </div>
    </div>
  );
}