import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { UploadCloud, Link as LinkIcon, Send, CheckCircle, FileText, Loader2, User, Users, ArrowLeft, FileType, QrCode } from 'lucide-react';
import confetti from 'canvas-confetti';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dcnsjzq0i/auto/upload"; 
const UPLOAD_PRESET = "gameedu";

export default function SubmitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState('');
  
  const [formData, setFormData] = useState({
      submissionCode: '', // [MỚI] Mã nộp bài
      teacherEmail: '',   // Email GV (Tự động tìm)
      name: '',       
      className: '',  
      type: 'LINK',   
      content: ''     
  });

  const fileInputRef = useRef(null);

  // Hàm kiểm tra mã và nộp bài
  const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!formData.submissionCode) return alert("Vui lòng nhập Mã Nộp Bài!");
      if (!formData.name || !formData.className || !formData.content) return alert("Nhập thiếu thông tin!");

      setLoading(true);

      try {
          // 1. Tìm giáo viên theo Mã
          const q = query(collection(firestore, "user_configs"), where("submissionCode", "==", formData.submissionCode.trim().toUpperCase()));
          const snap = await getDocs(q);

          if (snap.empty) {
              alert("❌ Mã nộp bài không tồn tại! Vui lòng kiểm tra lại với giáo viên.");
              setLoading(false);
              return;
          }

          // Lấy email giáo viên
          const teacherData = snap.docs[0].data();
          const targetEmail = teacherData.email; // Đã lưu email trong config ở bước trước

          if (!targetEmail) {
              alert("Giáo viên này chưa cập nhật email hệ thống. Vui lòng báo lại GV!");
              setLoading(false);
              return;
          }

          // 2. Gửi bài
          await addDoc(collection(firestore, "assignments"), {
              ...formData,
              teacherEmail: targetEmail, // Gửi đúng cho giáo viên này
              fileName: fileName || 'Unknown File',
              submittedAt: serverTimestamp(),
              status: 'PENDING' 
          });

          setSuccess(true);
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

      } catch (err) {
          console.error(err);
          alert("Lỗi kết nối!");
      } finally {
          setLoading(false);
      }
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 7 * 1024 * 1024) return alert("File quá lớn (>7MB)!");
      setLoading(true); setFileName(file.name);
      const data = new FormData(); data.append("file", file); data.append("upload_preset", UPLOAD_PRESET); data.append("folder", "Nop_BT_Nhom"); data.append("resource_type", "auto"); 
      try {
          const res = await fetch(CLOUDINARY_URL, { method: "POST", body: data });
          const result = await res.json();
          if (result.secure_url) setFormData({ ...formData, content: result.secure_url, type: 'FILE' });
          else { alert("Lỗi upload!"); setFileName(''); }
      } catch (err) { alert("Lỗi kết nối!"); setFileName(''); } finally { setLoading(false); }
  };

  if (success) return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white p-4 font-sans">
          <CheckCircle size={80} className="text-green-500 mb-4 animate-bounce"/>
          <h1 className="text-3xl font-black uppercase text-center mb-2">Nộp bài thành công!</h1>
          <p className="text-slate-400 mb-8">Bài làm đã gửi đến giáo viên.</p>
          <div className="flex gap-4">
            <button onClick={() => {setSuccess(false); setFormData({...formData, content: ''}); setFileName('');}} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition shadow-lg">Nộp bài khác</button>
            <button onClick={() => router.push('/')} className="bg-slate-800 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition border border-white/10">Về trang chủ</button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] font-sans flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0f172a] to-black -z-10"></div>
      
      <div className="bg-[#1e293b]/90 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-300">
        <button onClick={() => router.push('/')} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition font-bold text-xs uppercase tracking-wider"><ArrowLeft size={16}/> Quay lại</button>
        
        <h1 className="text-3xl font-black text-white italic uppercase mb-1 flex items-center gap-2">
            <UploadCloud className="text-blue-500" size={32}/> Cổng Nộp Bài
        </h1>
        <p className="text-slate-400 text-sm mb-8 font-medium">Nộp bài tập nhóm hoặc cá nhân</p>

        <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* [MỚI] NHẬP MÃ NỘP BÀI */}
            <div>
                <label className="block text-[10px] font-bold text-yellow-500 uppercase mb-2 ml-1">Mã nộp bài (Do giáo viên cung cấp)</label>
                <div className="relative">
                    <QrCode className="absolute left-4 top-3.5 text-slate-500" size={20}/>
                    <input 
                        className="w-full bg-[#0f172a] border-2 border-yellow-500/50 text-yellow-400 p-3 pl-12 rounded-xl outline-none focus:border-yellow-500 font-black placeholder-slate-700 transition-all uppercase tracking-widest text-lg"
                        placeholder="VD: TIN10A"
                        value={formData.submissionCode}
                        onChange={(e) => setFormData({...formData, submissionCode: e.target.value.toUpperCase()})}
                        autoFocus
                    />
                </div>
            </div>

            {/* Nhập Tên */}
            <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Tên Nhóm / Học Sinh</label>
                <div className="relative">
                    <User className="absolute left-4 top-3.5 text-slate-500" size={20}/>
                    <input 
                        className="w-full bg-[#0f172a] border-2 border-slate-700 text-white p-3 pl-12 rounded-xl outline-none focus:border-blue-500 font-bold placeholder-slate-600 transition-all"
                        placeholder="VD: Nhóm 1 hoặc Nguyễn Văn A"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                </div>
            </div>

            {/* Nhập Lớp */}
            <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Lớp</label>
                <div className="relative">
                    <Users className="absolute left-4 top-3.5 text-slate-500" size={20}/>
                    <input 
                        className="w-full bg-[#0f172a] border-2 border-slate-700 text-white p-3 pl-12 rounded-xl outline-none focus:border-blue-500 font-bold placeholder-slate-600 transition-all uppercase"
                        placeholder="VD: 10C1, 12A5..."
                        value={formData.className}
                        onChange={(e) => setFormData({...formData, className: e.target.value})}
                    />
                </div>
            </div>

            {/* Chọn Loại Nộp */}
            <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Hình thức nộp</label>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, type: 'LINK', content: ''})}
                        className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center gap-2 transition-all ${formData.type === 'LINK' ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-[#0f172a] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        <LinkIcon size={24}/> Nộp Link
                    </button>
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, type: 'FILE', content: ''})}
                        className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center gap-2 transition-all ${formData.type === 'FILE' ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'bg-[#0f172a] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        <UploadCloud size={24}/> Nộp File
                    </button>
                </div>
            </div>

            {/* Nội dung Nộp */}
            <div className="animate-in fade-in slide-in-from-top-2">
                {formData.type === 'LINK' ? (
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Dán Link Bài Làm (Google Drive, Docs...)</label>
                        <input 
                            className="w-full bg-[#0f172a] border-2 border-slate-700 text-blue-400 p-4 rounded-xl outline-none focus:border-blue-500 font-mono text-sm transition-all placeholder-slate-600"
                            placeholder="https://..."
                            value={formData.content}
                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Tải File (Word, Excel, Zip, Video... &lt;7MB)</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.zip,.rar,.7z,.jpg,.jpeg,.png,.mp4,.txt,.html"/>
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            className="w-full bg-[#0f172a] border-2 border-dashed border-slate-700 hover:border-orange-500 hover:bg-slate-800 p-8 rounded-xl cursor-pointer flex flex-col items-center justify-center text-slate-500 transition-all group"
                        >
                            {loading ? (
                                <div className="text-center"><Loader2 className="animate-spin text-orange-500 mx-auto mb-2" size={32}/><span className="text-xs font-bold text-orange-500 animate-pulse">Đang tải file lên...</span></div>
                            ) : formData.content ? (
                                <div className="text-center"><FileText size={40} className="text-green-500 mx-auto mb-2"/><span className="text-green-500 font-bold text-sm block mb-1">Đã tải lên xong!</span><span className="text-slate-400 text-xs max-w-[200px] truncate block">{fileName}</span></div>
                             ) : (
                                <><FileType size={40} className="group-hover:text-orange-500 mb-2 transition-colors"/><span className="font-bold text-xs uppercase">Nhấn để chọn file</span></>
                             )}
                        </div>
                    </div>
                )}
            </div>

            <button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-xl font-black text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]">
                {loading ? <Loader2 className="animate-spin"/> : <Send size={20}/>} GỬI BÀI NGAY
            </button>
        </form>
      </div>
    </div>
  );
}