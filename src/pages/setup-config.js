import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // BỔ SUNG getDoc ở đây
import { Save, Settings, QrCode, Image, Cpu, Clock, HelpCircle, ArrowRight, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';

export default function SetupConfig() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // Quản lý trạng thái mở/đóng hướng dẫn
    const [openGuide, setOpenGuide] = useState('gemini');

    // Cấu hình mặc định
    const [userConfig, setUserConfig] = useState({
        submissionCode: '',
        cloudinaryName: 'dfjm4v0wy', 
        cloudinaryPreset: 'eduarena', 
        geminiKey: '',
        geminiModel: 'gemini-3-flash-preview',
        timeMCQ: 15,
        timeTF: 30,
        timeSA: 30
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                // Sửa lỗi Turbopack: dùng replace thay vì push khi chưa có user
                router.replace('/');
            } else {
                setUser(currentUser);
                
                // === BỔ SUNG LOGIC KÉO DỮ LIỆU CŨ TỪ FIREBASE ===
                try {
                    const docRef = doc(firestore, "user_configs", currentUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        // Nếu đã có cấu hình, đắp dữ liệu cũ vào state (Dấu xanh sẽ sáng lên)
                        setUserConfig(prev => ({ ...prev, ...docSnap.data() }));
                    } else {
                        // Nếu là người mới hoàn toàn, mới tạo mã nộp bài random
                        setUserConfig(prev => ({
                            ...prev,
                            submissionCode: Math.random().toString(36).substring(2, 6).toUpperCase()
                        }));
                    }
                } catch (error) {
                    console.error("Lỗi khi tải cấu hình cũ:", error);
                }
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // 1. Lưu cấu hình API (Dùng merge: true để ghi đè an toàn, không tạo rác)
            await setDoc(doc(firestore, "user_configs", user.uid), {
                ...userConfig,
                email: user.email
            }, { merge: true });

            // 2. CHỐT CHẶN BẢO VỆ: Cập nhật luôn bảng users bằng đúng UID của Firebase Auth
            // Nếu đã có -> Cập nhật. Nếu chưa có -> Tạo mới 1 bản duy nhất.
            await setDoc(doc(firestore, "users", user.uid), {
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                role: 'teacher',
                status: 'active'
            }, { merge: true });

            // Sửa lỗi Turbopack: Phải có await trước router.push
            await router.push('/dashboard');
        } catch (error) {
            alert("Lỗi khi lưu cấu hình: " + error.message);
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        // Sửa lỗi Turbopack cho nút Bỏ qua
        await router.push('/dashboard');
    };

    if (!user) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" size={40}/></div>;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-2 sm:p-4 flex flex-col items-center justify-center selection:bg-cyan-500 selection:text-black relative z-0 overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#020617] to-[#020617] -z-10"></div>
            
            {/* HEADER */}
            <header className="text-center mb-4 lg:mb-6 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-1.5 rounded-lg shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                        <Settings size={20} className="text-white"/>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg">
                        Thiết Lập Vũ Khí
                    </h1>
                </div>
                <p className="text-slate-400 font-medium text-xs md:text-sm">Hoàn tất cấu hình API để kích hoạt tài khoản của bạn</p>
            </header>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 animate-in fade-in slide-in-from-bottom-8">
                
                {/* CỘT TRÁI: FORM CẤU HÌNH */}
                <div className="bg-[#1e293b] p-4 md:p-5 rounded-2xl border border-cyan-500/30 shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <form onSubmit={handleSaveConfig} className="space-y-4 relative z-10 flex-1">
                           <div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-1 mb-1.5">
                                <h3 className="text-purple-400 font-bold uppercase text-xs flex items-center gap-1.5">
                                    <Cpu size={14}/> Trí Tuệ Nhân Tạo (Gemini)
                                </h3>
                                {/* Hiển thị trạng thái dấu tròn đậm giống Dashboard */}
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${userConfig.geminiKey ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-600'}`}></div>
                                    <span className={`text-[10px] font-bold uppercase ${userConfig.geminiKey ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {userConfig.geminiKey ? 'Đã nhập Key' : 'Chưa có Key'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                <div className="sm:col-span-3 relative group">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Gemini API Key</label>
                                    <div className="relative">
                                        <input 
                                            type="password" 
                                            required 
                                            value={userConfig.geminiKey} 
                                            onChange={e=>setUserConfig({...userConfig, geminiKey: e.target.value})} 
                                            placeholder="AIzaSy..." 
                                            className={`w-full bg-slate-900 border ${userConfig.geminiKey ? 'border-emerald-500/50' : 'border-slate-700'} p-2.5 pr-10 rounded-lg text-white outline-none focus:border-purple-500 font-mono text-xs transition-all`}
                                        />
                                        {/* Nút bấm tiện ích để dán nhanh (Paste) */}
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const text = await navigator.clipboard.readText();
                                                    setUserConfig({...userConfig, geminiKey: text});
                                                } catch (err) {
                                                    alert("Vui lòng dán thủ công hoặc cấp quyền truy cập Clipboard cho trình duyệt.");
                                                }
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 p-1.5 transition-colors"
                                            title="Dán nhanh từ bộ nhớ tạm"
                                        >
                                            <Save size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Phiên bản Model</label>
                                    <select value={userConfig.geminiModel} onChange={e=>setUserConfig({...userConfig, geminiModel: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-lg text-white outline-none focus:border-purple-500 text-xs">
                                        <option value="gemini-3-flash-preview">gemini-3-flash-preview(free)</option>
                                        <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
                                        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Nhanh free)</option>                                        
                                        <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                                        <option value="gemini-1.5-pro">Gemini-1.5-pro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded-xl border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase text-xs flex items-center gap-1.5 mb-0.5"><QrCode size={14}/> Mã Nộp Bài Cho Học Sinh</h3>
                                <p className="text-[10px] text-slate-400 italic">MỖI GV ĐẶT 1 MÃ RIÊNG và Đưa mã này cho HS nộp bài lên Cổng Nộp Bài.</p>
                            </div>
                            <input required value={userConfig.submissionCode} onChange={e=>setUserConfig({...userConfig, submissionCode: e.target.value.toUpperCase()})} className="w-full sm:w-32 bg-slate-900 border border-blue-500/50 p-2 rounded-lg text-white font-black text-lg text-center outline-none focus:border-blue-500 tracking-widest uppercase" placeholder="TIN10A"/>
                        </div>

                        <div>
                            <h3 className="text-orange-400 font-bold uppercase text-xs mb-1.5 border-b border-white/10 pb-1 flex items-center gap-1.5"><Image size={14}/> Lưu Trữ Ảnh (Cloudinary)</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Cloud Name</label>
                                    <input required value={userConfig.cloudinaryName} onChange={e=>setUserConfig({...userConfig, cloudinaryName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white outline-none focus:border-orange-500 font-mono text-xs"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Upload Preset</label>
                                    <input required value={userConfig.cloudinaryPreset} onChange={e=>setUserConfig({...userConfig, cloudinaryPreset: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white outline-none focus:border-orange-500 font-mono text-xs"/>
                                </div>
                            </div>
                        </div>

                     

                        <div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-1 mb-1.5">
                                <h3 className="text-emerald-400 font-bold uppercase text-xs flex items-center gap-1.5"><Clock size={14}/> Cài đặt Game (Giây)</h3>
                                <span className="text-[11px] text-slate-400 italic hidden sm:block">Thời gian cho Arena Chiến Binh</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Trắc nghiệm</label><input type="number" value={userConfig.timeMCQ} onChange={e => setUserConfig({...userConfig, timeMCQ: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-white text-center outline-none focus:border-emerald-500 text-sm"/></div>
                                <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Đúng/Sai</label><input type="number" value={userConfig.timeTF} onChange={e => setUserConfig({...userConfig, timeTF: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-white text-center outline-none focus:border-emerald-500 text-sm"/></div>
                                <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Trả lời ngắn</label><input type="number" value={userConfig.timeSA} onChange={e => setUserConfig({...userConfig, timeSA: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-white text-center outline-none focus:border-emerald-500 text-sm"/></div>
                            </div>
                        </div>

                        <button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-3 rounded-xl font-black shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 mt-2 text-sm">
                            {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} {saving ? 'Đang kích hoạt...' : 'Lưu & Khởi Động Arena'}
                        </button>
                    </form>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                        <Info size={12} className="text-cyan-500 shrink-0" />
                        <span>Có thể thay đổi lại trong <strong>Dashboard {'>'} ARENA CẤU HÌNH</strong>.</span>
                    </div>
                </div>

                {/* CỘT PHẢI: HƯỚNG DẪN */}
                <div className="space-y-3 flex flex-col justify-between">
                    <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl flex items-start gap-2.5">
                        <HelpCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h3 className="text-blue-400 font-bold uppercase text-xs">Vì sao cần cấu hình?</h3>
                            <p className="text-slate-300 text-xs mt-1 leading-relaxed">Để Arena Edu hoạt động độc lập và hoàn toàn miễn phí, hệ thống cần kết nối với AI tạo đề (Gemini) của bạn. Mặc định kho lưu ảnh Cloudinary đã điền sẵn, <strong className="text-cyan-400">bạn chỉ cần lấy Gemini API Key</strong>.</p>
                        </div>
                    </div>

                    <div className="space-y-3 flex-1">
                        <div className="bg-[#1e293b] rounded-xl border border-white/10 overflow-hidden">
                            <button type="button" onClick={() => setOpenGuide(openGuide === 'gemini' ? null : 'gemini')} className="w-full p-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                <span className="font-bold text-purple-400 uppercase text-xs flex items-center gap-2"><Cpu size={16}/> 1. Cách lấy Gemini API Key</span>
                                {openGuide === 'gemini' ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                            </button>
                            {openGuide === 'gemini' && (
                                <div className="p-3 border-t border-white/5 text-[11px] md:text-xs text-slate-300 space-y-2 bg-slate-900/50 leading-relaxed">
                                    <p><strong>B1:</strong> Vào <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Google AI Studio</a>, đăng nhập bằng Google.</p>
                                    <p><strong>B2:</strong> Bấm nút <strong>"Create API key"</strong> màu xanh.</p>
                                    <p><strong>B3:</strong> Chọn dự án (nếu có) hoặc tạo mới {'>'} Bấm "Create API key in new project".</p>
                                    <p><strong>B4:</strong> Copy đoạn mã bắt đầu bằng <code>AIzaSy...</code> và dán vào ô bên trái.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-[#1e293b] rounded-xl border border-white/10 overflow-hidden">
                            <button type="button" onClick={() => setOpenGuide(openGuide === 'cloudinary' ? null : 'cloudinary')} className="w-full p-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                <span className="font-bold text-orange-400 uppercase text-xs flex items-center gap-2"><Image size={16}/> 2. Cách tạo Cloudinary (Tự chọn)</span>
                                {openGuide === 'cloudinary' ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                            </button>
                            {openGuide === 'cloudinary' && (
                                <div className="p-3 border-t border-white/5 text-[11px] md:text-xs text-slate-300 space-y-2 bg-slate-900/50 leading-relaxed">
                                    <p className="text-yellow-400 italic">* Hệ thống đã có sẵn mặc định, có thể bỏ qua bước này.</p>
                                    <p><strong>B1:</strong> Đăng ký miễn phí tại <a href="https://cloudinary.com/" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Cloudinary</a>.</p>
                                    <p><strong>B2:</strong> Copy <strong>Cloud Name</strong> dán vào ô bên trái.</p>
                                    <p><strong>B3:</strong> Vào Settings {'>'} Settings {'>'} Upload {'>'} Add upload preset.</p>
                                    <p><strong>B4:</strong> Chọn Signing Mode: <strong>Unsigned</strong>. Copy "Upload preset name" dán vào ô bên trái, lưu lại.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button type="button" onClick={handleSkip} className="w-full py-2.5 text-slate-500 hover:text-white text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1 mt-auto">
                        Bỏ qua bước này, tôi sẽ cài đặt sau <ArrowRight size={14}/>
                    </button>
                </div>
            </div>
        </div>
    );
}