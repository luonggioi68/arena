import { useState } from 'react';
import { useRouter } from 'next/router';
import { Flame, LogIn, Home } from 'lucide-react';

export default function TugOfWarEntry() {
    const router = useRouter();
    const [pinCode, setPinCode] = useState('');

    const handleJoinGame = (e) => {
        e.preventDefault();
        
        const cleanPin = pinCode.trim();
        if (!cleanPin) {
            alert('Vui lòng nhập mã PIN phòng máy!');
            return;
        }

        // Điều hướng sang trang động [pin].js
        router.push(`/play/tug-of-war/${cleanPin}`);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            
            {/* Hiệu ứng ánh sáng nền Rực lửa */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-orange-600/20 blur-[150px] rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-red-600/20 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Nút Trở về trang chủ */}
            <button 
                onClick={() => router.push('/')}
                className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-3 text-slate-400 hover:text-orange-500 font-bold transition-all z-20 group"
            >
                <div className="bg-[#111]/80 backdrop-blur p-2.5 rounded-xl border border-white/10 group-hover:border-orange-500/50 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all">
                    <Home size={22} className="drop-shadow-md" />
                </div>
                <span className="hidden md:block tracking-widest uppercase text-sm drop-shadow-md">Trang chủ</span>
            </button>

            <div className="relative z-10 w-full max-w-md mt-8">
                {/* Logo & Tiêu đề */}
                <div className="text-center mb-10 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-red-600 rounded-3xl border-2 border-white/20 shadow-[0_0_40px_rgba(239,68,68,0.6)] flex items-center justify-center mb-6 relative">
                        <Flame size={50} className="text-white animate-pulse" />
                    </div>
                    
                    <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] mb-2">
                        ARENA KÉO CO
                    </h1>
                    <div className="flex items-center justify-center gap-2 text-orange-400 font-black tracking-[0.3em] text-xs md:text-sm uppercase drop-shadow-md">
                        Sức mạnh là chiến thắng
                    </div>
                </div>

                {/* Form Nhập PIN */}
                <div className="bg-[#111]/90 backdrop-blur-xl p-8 rounded-[2.5rem] border-2 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden animate-in zoom-in-95 duration-500 delay-150">
                    {/* Vạch kẻ màu chạy trên đỉnh hộp */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600"></div>

                    <form onSubmit={handleJoinGame} className="flex flex-col gap-6 relative z-10">
                        <div className="relative">
                            <label className="block text-center text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">
                                Nhập mã PIN phòng máy
                            </label>
                            <input 
                                type="text" 
                                value={pinCode}
                                onChange={(e) => setPinCode(e.target.value.toUpperCase())}
                                placeholder="Ví dụ: 8899"
                                maxLength={6}
                                className="w-full bg-black border-2 border-slate-700 focus:border-orange-500 p-5 rounded-2xl text-white font-black text-4xl text-center outline-none transition-all shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] focus:shadow-[0_0_20px_rgba(249,115,22,0.2)] placeholder-slate-800 tracking-[0.2em]"
                                autoFocus
                            />
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white p-5 rounded-2xl font-black text-xl uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] hover:-translate-y-1 transition-all flex items-center justify-center gap-3 active:scale-95 border border-red-400/50 group"
                        >
                            Tham Chiến <LogIn size={26} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-600 text-[10px] font-black uppercase tracking-widest mt-8 animate-pulse">
                    Hệ thống thi đấu thời gian thực
                </p>
            </div>
        </div>
    );
}