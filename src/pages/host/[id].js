import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, update } from 'firebase/database'; 
import { Users, ArrowLeft, Loader2, Play } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore'; // Import auth store

export default function HostLobby() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuthStore();
  const [quiz, setQuiz] = useState(null);
  const [pin, setPin] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameConfig, setGameConfig] = useState({ timeMCQ: 15, timeTF: 15, timeSA: 30 }); // Mặc định

  useEffect(() => {
    if (!id || !user) return;
    
    // 1. Lấy dữ liệu đề thi
    getDoc(doc(firestore, "quizzes", id)).then((snap) => {
      if (snap.exists()) setQuiz(snap.data());
    });

    // 2. Lấy cấu hình thời gian của giáo viên
    getDoc(doc(firestore, "user_configs", user.uid)).then((snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setGameConfig({
                timeMCQ: data.timeMCQ || 15,
                timeTF: data.timeTF || 15,
                timeSA: data.timeSA || 30
            });
        }
    });

    // 3. Tạo mã PIN
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(newPin);

    // 4. Khởi tạo phòng (Chưa lưu config ngay, lưu lúc start game)
    const roomRef = ref(db, `rooms/${newPin}`);
    set(roomRef, {
      gameState: 'WAITING',
      currentQuestion: 0,
      viewMode: 'CLASSIC',
      quizId: id,
      quiz: null, 
      createdAt: Date.now()
    });

    const playersRef = ref(db, `rooms/${newPin}/players`);
    return onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayers(Object.values(snapshot.val()));
      } else {
        setPlayers([]);
      }
    });
  }, [id, user]);

  useEffect(() => {
    if (quiz && pin) {
      update(ref(db, `rooms/${pin}`), { quiz: quiz });
    }
  }, [quiz, pin]);

  const startGame = async () => {
    if (players.length === 0) {
        if(!confirm("Chưa có ai vào phòng, thầy vẫn muốn bắt đầu chứ?")) return;
    }
    // [CẬP NHẬT] Lưu cấu hình thời gian vào phòng
    await update(ref(db, `rooms/${pin}`), { 
        gameState: 'PREPARE',
        currentQuestion: 0,
        config: gameConfig 
    });
    router.push(`/host/game/${pin}`);
  };

  if (!quiz) return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col gap-3 items-center justify-center font-bold">
        <Loader2 className="animate-spin text-indigo-500" size={40}/>
        <span>Đang khởi tạo đấu trường...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans flex flex-col items-center p-4 md:p-6 text-center h-screen overflow-hidden">
      
      {/* Header: Đưa vào luồng linh hoạt trên Mobile, giữ absolute trên PC */}
      <div className="w-full flex justify-start mb-2 md:mb-0 md:absolute md:top-6 md:left-6 z-10">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white transition font-bold uppercase tracking-widest text-sm md:text-base bg-slate-800/50 md:bg-transparent px-4 py-2 md:p-0 rounded-lg md:rounded-none">
            <ArrowLeft size={18}/> Quay lại
        </button>
      </div>

      <h1 className="text-lg md:text-2xl font-bold text-indigo-400 mb-2 mt-2 md:mt-10 uppercase tracking-tighter italic animate-pulse">
          SẴN SÀNG TRIỆU TẬP...
      </h1>
      
      {/* Khung PIN */}
      <div className="bg-slate-800 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-b-[8px] md:border-b-[12px] border-indigo-600 mb-4 md:mb-8 w-full max-w-lg relative overflow-hidden group shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
        <p className="text-slate-400 font-bold mb-1 md:mb-2 uppercase text-xs md:text-base">Mã PIN tham gia:</p>
        <div className="text-6xl sm:text-7xl md:text-8xl font-black text-yellow-400 tracking-tighter drop-shadow-lg font-mono leading-none">{pin}</div>
      </div>

      {/* Bộ đếm người chơi */}
      <div className="flex items-center gap-2 mb-4 bg-white/5 px-4 md:px-6 py-2 rounded-full border border-white/10 shrink-0">
        <Users className="text-indigo-400 w-5 h-5 md:w-6 md:h-6" />
        <span className="text-lg md:text-2xl font-black">{players.length} chiến binh đã vào</span>
      </div>

      {/* Danh sách học sinh: Thiết lập cuộn độc lập để không đẩy nút Bắt đầu đi mất */}
      <div className="flex-1 w-full max-w-4xl overflow-y-auto custom-scrollbar mb-4 pr-1 md:pr-2 min-h-[100px]">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-4">
            {players.map((p, i) => (
            <div key={i} className="bg-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-xl animate-in zoom-in uppercase italic border border-white/5 flex items-center justify-center truncate">
                {p.name}
            </div>
            ))}
        </div>
        {players.length === 0 && (
            <div className="text-slate-500 italic mt-8 text-sm md:text-base flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin mb-2 opacity-50" size={24}/>
                Đang chờ chiến binh nhập mã PIN...
            </div>
        )}
      </div>

      {/* Khung điều khiển dưới cùng */}
      <div className="w-full max-w-md shrink-0 pb-2 md:pb-6">
          <button onClick={startGame} className="w-full bg-green-500 hover:bg-green-400 px-6 py-4 md:px-16 md:py-6 rounded-2xl md:rounded-full font-black text-xl md:text-3xl shadow-[0_6px_0_#15803d] md:shadow-[0_10px_0_#15803d] hover:translate-y-1 hover:shadow-[0_3px_0_#15803d] md:hover:shadow-[0_5px_0_#15803d] transition-all uppercase italic active:scale-95 flex items-center justify-center gap-2">
              BẮT ĐẦU NGAY <Play fill="currentColor" className="w-6 h-6 md:w-8 md:h-8"/>
          </button>
          
          <p className="mt-4 md:mt-6 text-slate-500 font-medium text-xs md:text-base">
              Học sinh nhập PIN tại: <span className="text-white font-bold bg-white/10 px-2 py-1 rounded">/play</span>
          </p>
      </div>

      {/* CSS làm đẹp thanh cuộn */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        @media (min-width: 768px) { .custom-scrollbar::-webkit-scrollbar { width: 6px; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}