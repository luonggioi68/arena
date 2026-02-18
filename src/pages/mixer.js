import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
// [ĐÃ BỔ SUNG ICON 'Info']
import { ArrowLeft, Upload, Target, CheckCircle, Loader2, Flame, Zap, Crosshair, Info } from 'lucide-react';

export default function ExamMixer() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);

  const [config, setConfig] = useState({
    donVi: 'LÂM ĐỒNG',
    truong: 'PT DTNT THCS & THPT TUY ĐỨC',
    kyThi: 'GIỮA KÌ 1',
    monThi: 'TOÁN HỌC 11',
    thoiGian: '90', 
    soDe: 4,
    maDeList: ['401', '702', '803', '304']
  });

  useEffect(() => {
    const currentLen = config.maDeList.length;
    const targetLen = parseInt(config.soDe) || 0;
    
    if (targetLen > currentLen) {
        const newCodes = Array.from({ length: targetLen - currentLen }, () => Math.floor(100 + Math.random() * 900).toString());
        setConfig(prev => ({ ...prev, maDeList: [...prev.maDeList, ...newCodes] }));
    } else if (targetLen < currentLen) {
        setConfig(prev => ({ ...prev, maDeList: prev.maDeList.slice(0, targetLen) }));
    }
  }, [config.soDe]);

  const handleMaDeChange = (index, value) => {
      const newList = [...config.maDeList];
      newList[index] = value;
      setConfig({ ...config, maDeList: newList });
  };

  const handleUpload = async () => {
      if (!file) return alert("Vui lòng chọn file đề gốc (.docx)!");
      if (!config.monThi) return alert("Vui lòng nhập Tên môn thi!");
      
      setLoading(true);
      try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('config', JSON.stringify(config)); 

          const response = await fetch('https://arena-mix-api.onrender.com/api/mix-docx', {
              method: 'POST',
              body: formData,
          });

          if (!response.ok) {
              const errorData = await response.json();
              if (errorData.details) {
                  const errorMsg = errorData.details.map((err, i) => `${i+1}. ${err}`).join('\n\n');
                  alert(`⛔ HỆ THỐNG PHÁT HIỆN LỖI TRONG FILE ĐỀ GỐC:\n\n${errorMsg}\n\n👉 Vui lòng mở file Word, sửa lại và tải lên lại nhé!`);
                  return;
              }
              throw new Error("Lỗi kết nối hoặc lỗi server ẩn!");
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Tap_De_Thi_${config.monThi.replace(/\s/g, '_')}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          
          alert("🔥 TUYỆT VỜI! Đã rèn xong vũ khí. Đang tải file ZIP xuống...");
      } catch (error) {
          console.error(error);
          alert("Lỗi hệ thống: " + error.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-red-50 font-sans flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] selection:bg-orange-500 selection:text-white p-2 sm:p-4">
      
      <div className="w-full max-w-5xl bg-zinc-900/90 rounded-2xl border border-red-600/30 shadow-[0_0_30px_rgba(220,38,38,0.15)] overflow-hidden relative backdrop-blur-sm">
        
        <div className="bg-gradient-to-r from-red-950 via-red-800 to-orange-600 p-4 md:px-6 relative overflow-hidden border-b border-red-500/50 flex items-center justify-between">
            <div className="absolute top-0 right-0 opacity-20 transform translate-x-4 -translate-y-6 text-orange-300 pointer-events-none">
                <Zap size={100} />
            </div>
            
            <div className="relative z-10 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 bg-black/40 hover:bg-black/60 border border-orange-500/30 text-orange-400 rounded-full transition-all duration-300">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 uppercase italic tracking-tight drop-shadow-md flex items-center gap-2">
                        <Flame size={28} className="text-orange-400 animate-pulse"/>
                        Arena Trộn Đề
                    </h1>
                    <p className="text-orange-200/90 text-xs md:text-sm font-bold tracking-wider uppercase flex items-center gap-1 mt-0.5">
                       <Crosshair size={14}/> Vũ khí tinh nhuệ cho GDPT 2018!
                    </p>
                </div>
            </div>
        </div>

        <div className="p-4 md:p-6 flex flex-col gap-4">
            <div>
                <h3 className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-1.5">
                    <Target size={16}/> Cấu hình Đề Thi
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/40 p-4 rounded-xl border border-red-900/50 shadow-inner">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-orange-300/70 mb-1 uppercase">Sở GD&ĐT</label>
                            <input value={config.donVi} onChange={e=>setConfig({...config, donVi: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 text-orange-50 px-3 py-1.5 text-sm rounded-lg outline-none focus:border-orange-500 transition-all placeholder-zinc-700"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-orange-300/70 mb-1 uppercase">Tên Trường</label>
                            <input value={config.truong} onChange={e=>setConfig({...config, truong: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 text-orange-50 px-3 py-1.5 text-sm rounded-lg outline-none focus:border-orange-500 transition-all"/>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-orange-300/70 mb-1 uppercase">Kỳ thi</label>
                            <input value={config.kyThi} onChange={e=>setConfig({...config, kyThi: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 text-orange-50 px-3 py-1.5 text-sm rounded-lg outline-none focus:border-orange-500 transition-all"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-orange-300/70 mb-1 uppercase">Tên Môn Thi</label>
                            <input value={config.monThi} onChange={e=>setConfig({...config, monThi: e.target.value})} className="w-full bg-zinc-950 border border-orange-600/50 text-orange-300 px-3 py-1.5 text-sm rounded-lg outline-none focus:border-orange-400 font-bold transition-all"/>
                        </div>
                    </div>

                    <div className="space-y-3 flex flex-col justify-between">
                        <div>
                            <label className="block text-[10px] font-bold text-orange-300/70 mb-1 uppercase">Thời gian (Phút)</label>
                            <input type="number" value={config.thoiGian} onChange={e=>setConfig({...config, thoiGian: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 text-orange-50 px-3 py-1.5 text-sm rounded-lg outline-none focus:border-orange-500 text-center font-bold transition-all"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-orange-300/70 mb-1 uppercase">Số đề cần tạo</label>
                            <input type="number" min="1" max="40" value={config.soDe} onChange={e=>setConfig({...config, soDe: e.target.value})} className="w-full bg-zinc-950 border border-red-500/80 text-red-400 px-3 py-1.5 text-sm rounded-lg outline-none focus:border-red-400 font-black text-center transition-all shadow-[0_0_10px_rgba(220,38,38,0.2)]"/>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                <div className="bg-black/30 p-4 rounded-xl border border-zinc-800 flex flex-col">
                    <h3 className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-2">Mã Đề Tự Động, có thể nhập tuỳ chọn số khác hoặc Nhậpmã đề 4 số</h3>
                    <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[110px] pr-1 custom-scrollbar">
                        {config.maDeList.map((ma, idx) => (
                            <div key={idx} className="bg-zinc-950 border border-red-900/50 p-1 rounded flex items-center w-14 relative group hover:border-orange-500 transition-colors">
                                <input type="text" value={ma} onChange={(e) => handleMaDeChange(idx, e.target.value)} className="w-full bg-transparent text-center text-orange-200 text-xs font-bold font-mono outline-none focus:text-yellow-400 z-10" maxLength={5}/>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <input type="file" accept=".docx" ref={fileInputRef} onChange={(e) => setFile(e.target.files[0])} className="hidden"/>
                    
                    {/* [MỚI] Nút Link Hướng Dẫn Nằm gọn gàng góc phải */}
                    <div className="flex justify-end mb-1">
                        <a href="/guide.html" target="_blank" rel="noopener noreferrer" className="text-[11px] text-zinc-400 hover:text-orange-400 flex items-center gap-1 transition-colors hover:underline underline-offset-2">
                            <Info size={13} /> Hướng dẫn soạn đề chuẩn
                        </a>
                    </div>

                    {file ? (
                        <div className="bg-orange-950/40 border border-orange-500/50 px-4 py-3 rounded-xl flex items-center justify-between shadow-[0_0_15px_rgba(249,115,22,0.15)] flex-1">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <CheckCircle className="text-orange-400 shrink-0" size={24}/>
                                <span className="text-orange-100 font-bold text-sm truncate">{file.name}</span>
                            </div>
                            <button onClick={()=>setFile(null)} className="ml-2 text-red-400 hover:text-red-300 font-bold uppercase text-[10px] px-2 py-1 bg-red-950/50 rounded border border-red-900/50 shrink-0">Hủy</button>
                        </div>
                    ) : (
                         <button onClick={() => fileInputRef.current.click()} className="flex-1 text-red-300/70 border border-dashed border-red-800/60 hover:border-orange-500 hover:text-orange-400 hover:bg-orange-950/20 px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 group">
                             <Upload size={22} className="group-hover:-translate-y-1 transition-transform duration-300"/>
                             <div className="flex flex-col items-start">
                                <span className="font-bold text-sm uppercase tracking-wide">Nạp Đề Gốc (.docx)</span>
                             </div>
                         </button>
                    )}

                    <button onClick={handleUpload} disabled={!file || loading} className={`w-full py-3 rounded-xl font-black text-lg uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 mt-1 ${file && !loading ? 'bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.4)] bg-[length:200%_auto] animate-gradient' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'}`}>
                        {loading ? (
                            <><Loader2 className="animate-spin" size={20} /> ĐANG RÈN...</>
                        ) : (
                            <><Flame size={20} className={file ? "animate-bounce" : ""} /> KHAI HOẢ TRỘN ĐỀ</>
                        )}
                    </button>
                </div>
            </div>

        </div>
      </div>
      
      <style dangerouslySetInline={{__html: `
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-gradient { animation: gradient 3s ease infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #7f1d1d; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ea580c; }
      `}} />
    </div>
  );
}