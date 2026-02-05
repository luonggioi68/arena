import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, getDoc, updateDoc } from 'firebase/firestore';
import { Shield, Lock, Send, Paperclip, X, PenTool, Heart, LogIn, ZoomIn, Loader2, Home, ArrowLeft, Timer, FileText, Download, Hash } from 'lucide-react';
import dynamic from 'next/dynamic';

// Import Lightbox
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

// Import Editor
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'quill/dist/quill.snow.css';

export default function InteractiveStudent() {
  const router = useRouter();
  const { id, name: queryName } = router.query; 
  const [authorized, setAuthorized] = useState(false);
  const [name, setName] = useState('');
  const [board, setBoard] = useState(null);
  const [notes, setNotes] = useState([]);
  
  // Config
  const [cloudConfig, setCloudConfig] = useState({ name: "dcnsjzq0i", preset: "gameedu" });

  // State soạn thảo
  const [isWriting, setIsWriting] = useState(false);
  const [content, setContent] = useState('');
  
  // State lưu file đính kèm đa năng
  const [attachment, setAttachment] = useState(null); // { url, type, name }
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // 1. TỰ ĐỘNG ĐĂNG NHẬP
  useEffect(() => {
      if (queryName) {
          setName(decodeURIComponent(queryName));
          setAuthorized(true);
      }
  }, [queryName]);

  // 2. LOAD DATA
  useEffect(() => {
    if (!id) return;
    const unsubBoard = onSnapshot(doc(firestore, "interactive_boards", id), async (boardDoc) => {
        if(boardDoc.exists()) {
            const boardData = boardDoc.data();
            setBoard(boardData);
            if (boardData.authorId) {
                try {
                    const configSnap = await getDoc(doc(firestore, "user_configs", boardData.authorId));
                    if (configSnap.exists()) {
                        const conf = configSnap.data();
                        if (conf.cloudinaryName && conf.cloudinaryPreset) {
                            setCloudConfig({ name: conf.cloudinaryName, preset: conf.cloudinaryPreset });
                        }
                    }
                } catch (e) { console.error("Lỗi config GV:", e); }
            }
        }
    });

    if (authorized) {
        const q = query(collection(firestore, `interactive_boards/${id}/notes`), where("approved", "==", true), orderBy("createdAt", "desc"));
        const unsubNotes = onSnapshot(q, (snapshot) => {
            setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => { unsubBoard(); unsubNotes(); };
    }
    return () => unsubBoard();
  }, [id, authorized]);

  // Logic Đồng hồ
  useEffect(() => {
      if (!board?.timerEnd) { setTimeLeft(null); return; }
      const interval = setInterval(() => {
          const remaining = board.timerEnd - Date.now();
          if (remaining <= 0) { setTimeLeft("HẾT GIỜ"); clearInterval(interval); } 
          else {
              const m = Math.floor(remaining / 60000);
              const s = Math.floor((remaining % 60000) / 1000);
              setTimeLeft(`${m}:${s < 10 ? '0' : ''}${s}`);
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [board?.timerEnd]);
// --- TỰ ĐỘNG KẾT THÚC GAME KHI KHÔNG CÒN AI ---
useEffect(() => {
  // 1. Chỉ chạy khi đã có dữ liệu game
  if (!gameData || !gameData.gameState) return;

  const state = gameData.gameState;
  const players = gameData.players || {};
  const playerCount = Object.keys(players).length;

  // 2. Nếu đang trong trận (QUESTION hoặc RESULT) mà số người chơi = 0
  // (Tức là học sinh đã thoát hết sạch)
  if ((state === 'QUESTION' || state === 'RESULT') && playerCount === 0) {
      
      // Cập nhật trạng thái về FINISHED
      update(ref(db, `rooms/${pin}`), { 
          gameState: 'FINISHED' 
      });
      
      // Thông báo cho Giáo viên và quay về Dashboard
      alert("⚠️ CẢNH BÁO: Tất cả chiến binh đã rời bỏ chiến trường!\nGame sẽ tự động kết thúc.");
      router.push('/dashboard');
  }

  // 3. (Tùy chọn) Nếu đang ở Sảnh chờ (LOBBY) quá lâu mà không có ai (tránh treo server)
  // Thầy có thể thêm logic timeout ở đây nếu muốn.
  
}, [gameData]); // Chạy lại mỗi khi dữ liệu game thay đổi
  // Xử lý Upload Đa năng (Ảnh + File)
  const handleFileUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      
      // Giới hạn 10MB
      if (file.size > 10 * 1024 * 1024) return alert("⚠️ File quá lớn (>10MB)!");

      setUploading(true);
      const formData = new FormData(); 
      formData.append("file", file); 
      formData.append("upload_preset", cloudConfig.preset);
      
      const cloudUrl = `https://api.cloudinary.com/v1_1/${cloudConfig.name}/auto/upload`;

      try {
          const res = await fetch(cloudUrl, { method: "POST", body: formData });
          const data = await res.json();
          if (data.secure_url) {
              setAttachment({
                  url: data.secure_url,
                  type: data.resource_type, // 'image', 'raw' (file), 'video'
                  name: file.name,
                  format: data.format
              });
          } else { alert("Lỗi tải file!"); }
      } catch (err) { alert("Lỗi kết nối!"); } finally { setUploading(false); }
  };

  const handleLogin = (e) => { e.preventDefault(); if (name.trim()) setAuthorized(true); else alert("Vui lòng nhập tên!"); };

  const handleSubmit = async () => {
      if (!content.trim() && !attachment) return alert("Nội dung trống!");
      
      setUploading(true);
      try {
          let finalContent = content;
          // Xử lý ảnh dán trực tiếp (Base64 -> Cloudinary)
          if (content.includes('src="data:image')) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(content, 'text/html');
              const images = doc.querySelectorAll('img');
              
              const uploadPromises = Array.from(images).map(async (img) => {
                  if (img.src.startsWith('data:image')) {
                      const formData = new FormData();
                      formData.append('file', img.src);
                      formData.append('upload_preset', cloudConfig.preset);
                      const cloudUrl = `https://api.cloudinary.com/v1_1/${cloudConfig.name}/image/upload`;
                      try {
                          const res = await fetch(cloudUrl, { method: "POST", body: formData });
                          const data = await res.json();
                          if (data.secure_url) img.src = data.secure_url; 
                      } catch (err) { console.error("Lỗi upload ảnh dán:", err); }
                  }
              });
              await Promise.all(uploadPromises);
              finalContent = doc.body.innerHTML;
          }

          await addDoc(collection(firestore, `interactive_boards/${id}/notes`), {
              content: finalContent,
              // Lưu thông tin file đính kèm
              image: attachment?.url || null, 
              fileType: attachment?.type || null,
              fileName: attachment?.name || null,
              
              author: name,
              createdAt: serverTimestamp(),
              approved: false, likes: 0
          });
          setContent(''); setAttachment(null); setIsWriting(false);
          alert("Đã gửi! Bài viết đang chờ giáo viên duyệt.");
      } catch (e) { alert("Lỗi: " + e.message); } finally { setUploading(false); }
  };

  const handleLike = async (noteId, currentLikes) => {
      await updateDoc(doc(firestore, `interactive_boards/${id}/notes`, noteId), { likes: (currentLikes || 0) + 1 });
  };

  // HÀM XỬ LÝ CLICK VÀO ẢNH DÁN TRONG NỘI DUNG
  const handleContentClick = (e) => {
      // Nếu click vào thẻ IMG, chặn sự kiện và mở Lightbox
      if (e.target.tagName === 'IMG') {
          e.preventDefault();
          e.stopPropagation();
          setZoomedImage(e.target.src);
      }
  };

  // Helper render file đính kèm (Upload)
  const renderAttachment = (note) => {
      if (!note.image) return null;
      
      // Nếu là ảnh 
      if (note.fileType === 'image' || (!note.fileType && note.image.match(/\.(jpeg|jpg|gif|png)$/))) {
          return (
              <div className="mt-2" onClick={() => setZoomedImage(note.image)}>
                  <div className="relative inline-block group/img cursor-zoom-in">
                      <img src={note.image} className="h-28 w-auto object-cover rounded-lg border-2 border-white/20 shadow-lg transform group-hover/img:rotate-2 transition-all duration-300 hover:border-orange-400" alt="Sticker"/>
                      <div className="absolute -bottom-2 -right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"><ZoomIn size={14}/></div>
                  </div>
              </div>
          );
      }
      
      // Nếu là file tài liệu
      return (
          <div className="mt-2">
              <a href={note.image} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition border border-white/10 group/file">
                  <div className="bg-blue-600 p-2 rounded-lg text-white"><FileText size={20}/></div>
                  <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-white truncate max-w-[150px]">{note.fileName || 'Tài liệu đính kèm'}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Nhấn để tải</p>
                  </div>
                  <Download size={16} className="text-slate-400 group-hover/file:text-white transition"/>
              </a>
          </div>
      );
  };

  if (!authorized) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans">
       <div className="bg-slate-900/80 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl w-full max-w-sm border-t-4 border-orange-500 text-center animate-in zoom-in">
           <Shield size={40} className="text-white mx-auto mb-4" fill="currentColor"/>
           <h1 className="text-3xl font-black text-white uppercase italic mb-8">Chiến Binh Arena</h1>
           <form onSubmit={handleLogin} className="space-y-4">
               <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-950 p-4 rounded-xl font-bold text-white border-2 border-slate-800 focus:border-orange-500 outline-none uppercase text-center" placeholder="Nhập tên..." autoFocus/>
               <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-black py-4 rounded-xl uppercase italic flex items-center justify-center gap-2"><LogIn size={20}/> Truy Cập</button>
           </form>
           <button onClick={() => router.push('/')} className="mt-6 text-slate-500 hover:text-white text-xs font-bold uppercase border-b border-transparent hover:border-white transition pb-1">Về Trang Chủ</button>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-orange-500 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
      
      {/* CSS cho ảnh dán: nhỏ gọn + click để zoom */}
      <style jsx global>{` 
        .ql-editor img { 
            max-height: 150px !important; 
            width: auto !important; 
            border-radius: 8px; 
            cursor: zoom-in; 
            border: 2px solid rgba(255,255,255,0.1); 
            transition: transform 0.2s; 
            display: inline-block; 
            margin: 5px; 
        } 
        .ql-editor img:hover { 
            transform: scale(1.05) rotate(2deg); 
            border-color: #f97316; 
        } 
        .yarl__portal { z-index: 9999 !important; } 
      `}</style>

      {/* HEADER */}
      <div className="h-[60px] bg-slate-950/90 border-b border-orange-500/30 px-4 flex justify-between items-center fixed top-0 w-full z-30 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-2 rounded-lg transition-all" title="Về Trang Chủ"><Home size={18} /></button>
              <div className="h-6 w-px bg-white/10 mx-1"></div>
              <div className="bg-orange-600 p-1.5 rounded-lg"><Shield size={18} className="text-white" fill="currentColor"/></div>
              
              {/* [ĐÃ BỔ SUNG] TIÊU ĐỀ + MÃ PHÒNG */}
              <div className="flex flex-col">
                  <span className="font-black italic uppercase text-sm md:text-base tracking-wider text-orange-100 hidden md:block">Chiến Binh Arena Tương Tác</span>
                  {board?.code && (
                      <span className="flex items-center gap-1 bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-black font-mono tracking-widest shadow-sm w-fit mt-0.5">
                          <Hash size={10}/> {board.code}
                      </span>
                  )}
              </div>
          </div>
          <div className="flex items-center gap-4">
              {timeLeft && (<div className={`flex items-center gap-2 font-mono text-xl md:text-2xl font-black ${timeLeft === "HẾT GIỜ" ? "text-red-500 animate-bounce" : "text-green-400"}`}><Timer size={20} className={timeLeft !== "HẾT GIỜ" ? "animate-pulse" : ""} />{timeLeft}</div>)}
              <div className="hidden md:block h-6 w-px bg-white/10"></div>
              <div className="flex items-center gap-3">
                  <span className="text-xs md:text-sm text-slate-300 font-bold uppercase tracking-wide bg-slate-800 px-3 py-1 rounded-full border border-white/10 truncate max-w-[100px] md:max-w-none">{name}</span>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${board?.status === 'OPEN' ? 'bg-green-900/50 border-green-500/50 text-green-400' : 'bg-red-900/50 border-red-500/50 text-red-400'}`}><div className={`w-2 h-2 rounded-full ${board?.status === 'OPEN' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div><span className="text-[10px] font-black uppercase hidden md:block">{board?.status === 'OPEN' ? 'ONLINE' : 'LOCKED'}</span></div>
              </div>
          </div>
      </div>

      {/* BOARD CONTENT */}
      <div className="pt-[80px] p-4 pb-32 max-w-7xl mx-auto">
          {board?.status === 'LOCKED' && (<div className="text-center py-12 opacity-70 animate-pulse"><Lock size={60} className="mx-auto mb-4 text-red-500"/><p className="uppercase font-bold tracking-widest text-red-300">Bảng đang tạm khóa</p><button onClick={() => router.push('/')} className="mt-4 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition">Thoát ra</button></div>)}
          {notes.length === 0 ? (<div className="text-center py-20 text-slate-600"><p className="italic">Chưa có bài viết nào được duyệt...</p></div>) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                  {notes.map((note) => (
                      <div key={note.id} className="break-inside-avoid bg-slate-800/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl hover:border-orange-500/50 transition-all hover:-translate-y-1 group">
                          <div className="flex justify-between items-center mb-3"><span className="font-black text-orange-400 text-xs uppercase tracking-wide bg-black/30 px-2 py-1 rounded truncate max-w-[120px]">{note.author}</span><span className="text-[10px] text-slate-500">{new Date(note.createdAt?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                          
                          {/* [FIX] GÁN SỰ KIỆN CLICK VÀO NỘI DUNG ĐỂ PHÓNG TO ẢNH */}
                          <div 
                            className="text-sm text-slate-200 mb-3 break-words leading-relaxed ql-editor p-0" 
                            dangerouslySetInnerHTML={{ __html: note.content }} 
                            onClick={handleContentClick}
                          ></div>
                          
                          {/* Render Attachment (File Upload) */}
                          {renderAttachment(note)}
                          
                          <div className="flex justify-end pt-3 border-t border-white/5 mt-2"><button onClick={() => handleLike(note.id, note.likes)} className={`flex items-center gap-1.5 text-xs font-bold transition px-3 py-1.5 rounded-full ${note.likes > 0 ? 'text-pink-400 bg-pink-500/10' : 'text-slate-500 hover:text-pink-400 hover:bg-white/5'}`}><Heart size={14} fill={note.likes > 0 ? "currentColor" : "none"}/> {note.likes || 0}</button></div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* FAB */}
      {board?.status === 'OPEN' && (<button onClick={() => setIsWriting(true)} className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full shadow-[0_0_30px_rgba(234,88,12,0.6)] flex items-center justify-center text-white z-40 hover:scale-110 transition-transform active:scale-95 animate-bounce-slow"><PenTool size={28}/></button>)}

      {/* MODAL EDITOR */}
      {isWriting && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 w-full max-w-xl md:rounded-[2rem] rounded-t-[2rem] border-t-4 md:border-4 border-orange-500 shadow-2xl p-6 relative animate-in slide-in-from-bottom duration-300">
                  <button onClick={() => setIsWriting(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white bg-white/10 p-2 rounded-full"><X size={20}/></button>
                  <h3 className="font-black text-white italic uppercase mb-6 text-xl flex items-center gap-2"><PenTool size={20} className="text-orange-500"/> Soạn thảo chiến thư</h3>
                  <div className="bg-white text-black rounded-xl overflow-hidden mb-4 border-2 border-slate-700 shadow-inner"><ReactQuill theme="snow" value={content} onChange={setContent} placeholder="Nội dung thảo luận..." modules={{ toolbar: [[{'header':[1,2,false]}], ['bold', 'italic', 'underline', 'strike'], [{'color': []}, {'background': []}], [{'list': 'ordered'}, {'list': 'bullet'}], ['clean']] }} className="h-48"/></div>
                  
                  {/* UPLOAD ĐA NĂNG */}
                  <div className="flex items-center gap-4 mb-6 bg-slate-800 p-3 rounded-xl border border-white/10">
                      <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current.click()} className="bg-slate-700 text-slate-200 px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-600 transition shadow-md">
                          <Paperclip size={18}/> {uploading ? 'Đang tải...' : 'Đính kèm'}
                      </button>
                      
                      {attachment && (
                          <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-green-500/50">
                              {attachment.type === 'image' ? <ZoomIn size={16} className="text-green-400"/> : <FileText size={16} className="text-blue-400"/>}
                              <span className="text-xs text-white truncate max-w-[150px]">{attachment.name}</span>
                              <button onClick={() => setAttachment(null)} className="text-red-400 hover:text-red-300"><X size={14}/></button>
                          </div>
                      )}
                      {!attachment && !uploading && <span className="text-xs text-slate-500 italic">Ảnh, PDF, Word, Excel...</span>}
                  </div>

                  <button onClick={handleSubmit} disabled={uploading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-4 rounded-xl text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                      <Send size={24}/> {uploading ? 'Đang xử lý...' : 'Gửi Lên Bảng'}
                  </button>
              </div>
          </div>
      )}

      <Lightbox open={Boolean(zoomedImage)} close={() => setZoomedImage(null)} slides={[{ src: zoomedImage }]} plugins={[Zoom]} zoom={{ maxZoomPixelRatio: 5 }} render={{ buttonPrev: () => null, buttonNext: () => null }} />
    </div>
  );
}