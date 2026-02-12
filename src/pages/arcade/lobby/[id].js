import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { GAME_MODES } from '../../../lib/gameConfig'; 
import { ChevronLeft, Flame, Swords, Info } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore'; 
import { firestore } from '@/lib/firebase';
import useAuthStore from '@/store/useAuthStore'; // [MỚI] Import để check user

const customStyles = `
  @keyframes fire-pulse {
    0% { text-shadow: 0 0 4px #fefcc9, 10px -10px 6px #feec85, -20px -20px 15px #ffae34, 20px -40px 20px #ec760c; }
    50% { text-shadow: 0 0 4px #fefcc9, 10px -12px 8px #feec85, -22px -22px 17px #ffae34, 22px -42px 22px #ec760c; }
    100% { text-shadow: 0 0 4px #fefcc9, 10px -10px 6px #feec85, -20px -20px 15px #ffae34, 20px -40px 20px #ec760c; }
  }
  .bg-magma { background: radial-gradient(circle at center, #450a0a 0%, #000000 100%); }
  .card-battle:hover { box-shadow: 0 0 25px rgba(239, 68, 68, 0.5); border-color: #fca5a5; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

export default function LobbyPage() {
  const router = useRouter();
  const { id, from } = router.query;
  const { user } = useAuthStore(); // [MỚI] Lấy thông tin user
  
  const [quizTitle, setQuizTitle] = useState("Đang nạp đạn...");
  const [backGrade, setBackGrade] = useState(null);

  useEffect(() => {
    if (id) {
        const fetchData = async () => {
            try {
                const docRef = doc(firestore, "quizzes", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setQuizTitle(data.title || "NHIỆM VỤ BÍ MẬT");
                    setBackGrade(data.grade || 10);
                }
            } catch (error) { console.error(error); }
        };
        fetchData();
    }
  }, [id]);

  const handleSelectGame = (mode) => {
    const queryParams = from ? { from: from } : {};
    const examParams = from ? { source: from } : {};

    if (mode.type === 'EXAM') {
      router.push({ pathname: `/arcade/exam/${id}`, query: examParams });
    } else {
      router.push({ pathname: `/arcade/${id}`, query: { ...queryParams, game: mode.id } });
    }
  };

  const handleBack = () => {
      if (from === 'dashboard') router.push('/dashboard');
      else router.push(backGrade ? `/training?grade=${backGrade}` : '/training');
  };

  return (
    <div className="h-screen bg-black text-white font-sans overflow-hidden flex flex-col relative">
      <style>{customStyles}</style>
      <div className="fixed inset-0 bg-magma -z-20"></div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 -z-10"></div>

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-b border-red-900/50 bg-black/40 backdrop-blur-md z-50 shadow-lg shrink-0">
        <button onClick={handleBack} className="group flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-red-500 px-4 py-1.5 rounded-l-2xl rounded-tr-xl transition-all shadow-lg order-1 md:order-none">
            <ChevronLeft size={18} className="text-slate-400 group-hover:text-red-500"/> 
            <span className="font-black text-[10px] uppercase tracking-widest text-slate-300">{from === 'dashboard' ? 'Về Kho Vũ Khí' : 'Rút lui'}</span>
        </button>

        <div className="text-center order-first md:order-none w-full md:w-auto mb-2 md:mb-0">
            <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 drop-shadow-md">KHO GAME</h1>
            <p className="text-[9px] font-bold text-yellow-500 uppercase tracking-[0.3em]">Nơi Khởi Nguồn Tri Thức</p>
        </div>

        <div className="text-right bg-red-950/40 border border-red-500/30 px-3 py-1 rounded-lg order-2 md:order-none hidden md:block">
            <span className="block text-red-200 font-bold text-xs uppercase tracking-wider truncate max-w-[150px]">{quizTitle}</span>
            <span className="text-[8px] text-red-400 font-bold uppercase flex items-center justify-end gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>Sẵn sàng</span>
        </div>
      </header>

      {/* [MỚI] THÔNG BÁO CHẾ ĐỘ KHÁCH */}
      {!user && (
          <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-blue-900/40 border-b border-blue-500/30 py-2 px-4 animate-in fade-in slide-in-from-top-4 duration-700 flex items-center justify-center gap-3 shadow-lg">
              <div className="bg-blue-500/20 p-1.5 rounded-full text-blue-400 shrink-0"><Info size={16} /></div>
              <p className="text-[10px] md:text-xs font-bold text-blue-200 uppercase tracking-widest">
                  🎮 Chế độ <span className="text-yellow-400">Khách</span>: <button onClick={() => router.push('/training')} className="underline hover:text-white transition-colors">Đăng nhập</button> để có tên trên <span className="text-yellow-400">Bảng Vàng</span> & lưu điểm XP!
              </p>
          </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col items-center justify-start pt-8 pb-10 px-4 overflow-y-auto no-scrollbar w-full">
        
        <div className="text-center mb-5 shrink-0">
            <p className="text-red-500 font-black uppercase tracking-[0.2em] text-xs animate-pulse">
                <Flame className="inline-block mb-1 mr-1" size={14}/> Chọn Vũ Khí Của Bạn <Flame className="inline-block mb-1 ml-1" size={14}/>
            </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 w-full max-w-7xl">
            {GAME_MODES.map((mode, index) => (
                <div 
                    key={mode.id}
                    onClick={() => handleSelectGame(mode)}
                    className="card-battle group relative w-44 md:w-52 h-48 cursor-pointer overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-5 group-hover:opacity-15`}></div>
                    
                    {mode.badge && (
                        <div className={`absolute top-0 right-0 z-20 px-2 py-0.5 text-[8px] font-black uppercase rounded-bl-lg ${mode.badge === 'HOT' ? 'bg-red-600 text-white animate-pulse' : 'bg-yellow-500 text-black'}`}>{mode.badge}</div>
                    )}

                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
                        <div className="relative mb-3">
                            <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:border-red-500 group-hover:rotate-6 transition-all duration-500 shadow-lg">
                                <mode.icon size={28} className="text-slate-300 group-hover:text-white" />
                            </div>
                        </div>

                        <h3 className="text-xs md:text-sm font-black uppercase leading-tight text-white mb-1 group-hover:text-red-400">{mode.title}</h3>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter group-hover:text-slate-300">{mode.subtitle}</p>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-black/90 border-t border-red-500/30">
                        <button className="w-full py-1.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-md font-black text-[9px] uppercase text-white flex items-center justify-center gap-1">
                            <Swords size={12}/> CHIẾN
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </main>

      <div className="p-2 text-center opacity-20 shrink-0">
          <p className="text-[8px] font-mono text-red-500 uppercase tracking-[0.5em]">SYSTEM ONLINE // GUEST MODE SUPPORTED</p>
      </div>
    </div>
  );
}