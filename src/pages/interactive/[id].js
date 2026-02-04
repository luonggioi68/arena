import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, collection, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { 
    ArrowLeft, Lock, Unlock, Trash2, CheckCircle, Heart, Image as ImageIcon, 
    Shield, Loader2, X, Maximize2, PenTool, Send, UserCheck, GripVertical, 
    SortAsc, SortDesc, Edit3, ZoomIn, Ban, Timer, Play, StopCircle 
} from 'lucide-react';
import dynamic from 'next/dynamic';

// --- THƯ VIỆN KÉO THẢ ---
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- THƯ VIỆN LIGHTBOX ---
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom"; 
import "yet-another-react-lightbox/styles.css";

// Import Editor
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'quill/dist/quill.snow.css';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dcnsjzq0i/image/upload"; 
const UPLOAD_PRESET = "gameedu";

// --- COMPONENT THẺ BÀI VIẾT ---
function SortableItem({ note, isManualMode, onApprove, onDelete, onLike, onEdit, setZoomedImage }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
        id: note.id,
        disabled: !isManualMode 
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 'auto',
    };

    const handleContentClick = (e) => {
        if (e.target.tagName === 'IMG') {
            e.stopPropagation();
            setZoomedImage(e.target.src);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative break-inside-avoid rounded-2xl p-4 shadow-lg border-2 transition-all group ${note.isTeacher ? 'bg-indigo-900/40 border-indigo-500 shadow-indigo-500/20' : (note.approved ? 'bg-slate-900 border-green-900/50' : 'bg-slate-800/50 border-slate-700 opacity-75')}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    {isManualMode && (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-white">
                            <GripVertical size={18}/>
                        </div>
                    )}
                    <div>
                        <span className={`font-black text-sm uppercase block ${note.isTeacher ? 'text-yellow-400 flex items-center gap-1' : 'text-orange-400'}`}>
                            {note.isTeacher && <UserCheck size={14}/>} {note.author}
                        </span>
                        <span className="text-[10px] text-slate-500">{note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
                    </div>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(note)} className="p-1.5 rounded-full bg-slate-700 text-blue-400 hover:bg-blue-600 hover:text-white" title="Sửa bài"><Edit3 size={14}/></button>
                    <button onClick={() => onApprove(note.id, note.approved)} className={`p-1.5 rounded-full ${note.approved ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-green-600 hover:text-white'}`} title={note.approved ? "Ẩn bài" : "Duyệt bài"}><CheckCircle size={14}/></button>
                    <button onClick={() => onDelete(note.id)} className="p-1.5 rounded-full bg-slate-700 text-slate-400 hover:bg-red-600 hover:text-white" title="Xóa bài"><Trash2 size={14}/></button>
                </div>
            </div>

            <div className="text-sm text-slate-200 mb-3 break-words ql-editor p-0 leading-relaxed" dangerouslySetInnerHTML={{ __html: note.content }} onClick={handleContentClick}></div>
            
            {note.image && (
                <div className="relative group/img cursor-zoom-in overflow-hidden rounded-lg border border-white/10 mb-3" onClick={() => setZoomedImage(note.image)}>
                    <img src={note.image} className="w-full h-auto object-cover transition-transform duration-500 group-hover/img:scale-105"/>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                        <ZoomIn size={32} className="text-white drop-shadow-lg"/>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center border-t border-white/5 pt-2">
                <button onClick={() => onLike(note.id, note.likes)} className="flex items-center gap-1 text-xs font-bold text-pink-400 hover:text-pink-300 transition">
                    <Heart size={14} fill={note.likes > 0 ? "currentColor" : "none"}/> {note.likes || 0}
                </button>
                {!note.approved ? (
                    <span className="text-[10px] font-bold text-yellow-500 uppercase bg-yellow-500/10 px-2 py-0.5 rounded animate-pulse">Chờ duyệt</span>
                ) : (
                    <span className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1"><CheckCircle size={10}/> Đã hiện</span>
                )}
            </div>
        </div>
    );
}

// --- COMPONENT CHÍNH ---
export default function InteractiveBoardHost() {
  const router = useRouter();
  const { id } = router.query;
  const [board, setBoard] = useState(null);
  const [notes, setNotes] = useState([]);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [sortMode, setSortMode] = useState('NEWEST'); 

  // State Soạn thảo
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null); 
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // [MỚI] State Đồng hồ đếm ngược
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), 
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!id) return;
    const unsubBoard = onSnapshot(doc(firestore, "interactive_boards", id), (d) => setBoard({ id: d.id, ...d.data() }));
    const unsubNotes = onSnapshot(collection(firestore, `interactive_boards/${id}/notes`), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotes(data);
    });
    return () => { unsubBoard(); unsubNotes(); };
  }, [id]);

  // [MỚI] Logic Đồng hồ đếm ngược
  useEffect(() => {
      if (!board?.timerEnd) {
          setTimeLeft(null);
          return;
      }

      const interval = setInterval(() => {
          const now = Date.now();
          const remaining = board.timerEnd - now;

          if (remaining <= 0) {
              setTimeLeft("HẾT GIỜ");
              clearInterval(interval);
          } else {
              const m = Math.floor(remaining / 60000);
              const s = Math.floor((remaining % 60000) / 1000);
              setTimeLeft(`${m}:${s < 10 ? '0' : ''}${s}`);
          }
      }, 1000);

      return () => clearInterval(interval);
  }, [board?.timerEnd]);

  // [MỚI] Xử lý Bắt đầu/Dừng Đồng hồ (Lưu vào Firebase)
  const handleStartTimer = async () => {
      const millis = timerMinutes * 60 * 1000;
      const endTime = Date.now() + millis;
      await updateDoc(doc(firestore, "interactive_boards", id), { timerEnd: endTime });
      setShowTimerInput(false);
  };

  const handleStopTimer = async () => {
      await updateDoc(doc(firestore, "interactive_boards", id), { timerEnd: null });
  };

  const sortedNotes = useMemo(() => {
      let sorted = [...notes];
      if (sortMode === 'NEWEST') sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      else if (sortMode === 'OLDEST') sorted.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      else if (sortMode === 'LIKES') sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      else if (sortMode === 'MANUAL') sorted.sort((a, b) => (a.order || 0) - (b.order || 0));
      return sorted;
  }, [notes, sortMode]);

  const handleDragEnd = async (event) => {
      const { active, over } = event;
      if (active.id !== over.id) {
          const oldIndex = sortedNotes.findIndex((item) => item.id === active.id);
          const newIndex = sortedNotes.findIndex((item) => item.id === over.id);
          const newOrder = arrayMove(sortedNotes, oldIndex, newIndex);
          setNotes(newOrder); 
          const batch = writeBatch(firestore);
          newOrder.forEach((note, index) => {
              const ref = doc(firestore, `interactive_boards/${id}/notes`, note.id);
              batch.update(ref, { order: index });
          });
          await batch.commit();
      }
  };

  const openEditor = (note = null) => {
      if (note) {
          setEditingNote(note); setContent(note.content); setImage(note.image);
      } else {
          setEditingNote(null); setContent(''); setImage(null);
      }
      setIsEditorOpen(true);
  };

  const handleSubmit = async () => {
      if (!content.trim() && !image) return alert("Nội dung trống!");
      setUploading(true);
      try {
          let finalContent = content;
          if (content.includes('src="data:image')) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(content, 'text/html');
              const images = doc.querySelectorAll('img');
              const uploadPromises = Array.from(images).map(async (img) => {
                  if (img.src.startsWith('data:image')) {
                      const formData = new FormData();
                      formData.append('file', img.src);
                      formData.append('upload_preset', UPLOAD_PRESET);
                      try {
                          const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
                          const data = await res.json();
                          if (data.secure_url) { img.src = data.secure_url; }
                      } catch (err) { console.error("Lỗi upload ảnh dán:", err); }
                  }
              });
              await Promise.all(uploadPromises);
              finalContent = doc.body.innerHTML;
          }

          if (editingNote) {
              await updateDoc(doc(firestore, `interactive_boards/${id}/notes`, editingNote.id), { content: finalContent, image, isEdited: true });
          } else {
              await addDoc(collection(firestore, `interactive_boards/${id}/notes`), {
                  content: finalContent, image: image || null, author: "GIÁO VIÊN", createdAt: serverTimestamp(), approved: true, likes: 0, isTeacher: true, order: notes.length 
              });
          }
          setIsEditorOpen(false); setContent(''); setImage(null); setEditingNote(null);
      } catch (e) { alert("Lỗi: " + e.message); } finally { setUploading(false); }
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 7 * 1024 * 1024) { alert("⚠️ Ảnh quá lớn! Vui lòng chọn ảnh dưới 7MB."); return; }
      setUploading(true);
      const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET);
      try {
          const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
          const data = await res.json();
          if (data.secure_url) setImage(data.secure_url);
      } catch (err) { alert("Lỗi upload!"); } finally { setUploading(false); }
  };

  const toggleLock = async () => {
    const newStatus = board.status === 'OPEN' ? 'LOCKED' : 'OPEN';
    await updateDoc(doc(firestore, "interactive_boards", id), { status: newStatus });
  };

  const likeNote = async (noteId, currentLikes) => { await updateDoc(doc(firestore, `interactive_boards/${id}/notes`, noteId), { likes: (currentLikes || 0) + 1 }); };
  const approveNote = async (noteId, currentStatus) => { await updateDoc(doc(firestore, `interactive_boards/${id}/notes`, noteId), { approved: !currentStatus }); };
  const deleteNote = async (noteId) => { if(confirm("Xóa bài viết này?")) await deleteDoc(doc(firestore, `interactive_boards/${id}/notes`, noteId)); };

  const handleDeleteAll = async () => {
      if (!confirm("⚠️ CẢNH BÁO: XÓA SẠCH toàn bộ bài viết?")) return;
      try {
          const batch = writeBatch(firestore);
          const notesRef = collection(firestore, `interactive_boards/${id}/notes`);
          const snapshot = await getDocs(notesRef);
          if (snapshot.empty) return alert("Bảng đang trống!");
          snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
          await batch.commit();
          alert("Đã dọn dẹp!");
      } catch (e) { alert("Lỗi: " + e.message); }
  };

  if (!board) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-orange-500">
      <style jsx global>{` .ql-editor img { max-height: 150px !important; width: auto !important; border-radius: 8px; cursor: zoom-in; border: 2px solid rgba(255,255,255,0.1); transition: transform 0.2s; display: inline-block; margin: 5px; } .ql-editor img:hover { transform: scale(1.05); border-color: #f97316; } .yarl__portal { z-index: 9999 !important; } `}</style>

      {/* HEADER */}
      <div className="h-[70px] bg-slate-950/90 border-b border-orange-600/30 px-6 flex justify-between items-center fixed top-0 w-full z-40 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white"><ArrowLeft size={20}/></button>
              <div className="flex flex-col">
                  {/* [MỚI] HIỂN THỊ ĐỒNG HỒ ĐẾM NGƯỢC */}
                  {timeLeft ? (
                      <div className={`flex items-center gap-2 font-mono text-2xl font-black ${timeLeft === "HẾT GIỜ" ? "text-red-500 animate-bounce" : "text-green-400"}`}>
                          <Timer size={24} className={timeLeft !== "HẾT GIỜ" ? "animate-pulse" : ""}/> {timeLeft}
                          <button onClick={handleStopTimer} className="ml-2 text-slate-500 hover:text-red-500"><StopCircle size={20}/></button>
                      </div>
                  ) : (
                      <>
                        <span className="font-black italic uppercase text-lg tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">Chiến binh Arena Tương Tác</span>
                        <span className="font-bold text-slate-400 text-xs uppercase truncate max-w-[200px]">{board.title}</span>
                      </>
                  )}
              </div>
          </div>
          
          <div className="flex items-center gap-3">
              {/* [MỚI] NÚT HẸN GIỜ (CHỈ GV THẤY) */}
              {!timeLeft && (
                  <button onClick={() => setShowTimerInput(!showTimerInput)} className="flex items-center gap-2 bg-slate-800 text-cyan-400 px-3 py-2 rounded-lg font-bold text-xs hover:bg-slate-700 border border-cyan-900 transition">
                      <Timer size={16}/> Hẹn Giờ
                  </button>
              )}

              {/* Popup nhập thời gian */}
              {showTimerInput && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
                      <span className="text-sm font-bold text-slate-300">Phút:</span>
                      <input type="number" value={timerMinutes} onChange={e => setTimerMinutes(e.target.value)} className="w-16 bg-black border border-slate-600 rounded p-1 text-center font-bold text-white outline-none focus:border-cyan-500" min="1" max="60"/>
                      <button onClick={handleStartTimer} className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-lg font-bold"><Play size={16}/></button>
                      <button onClick={() => setShowTimerInput(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                  </div>
              )}

              <div className="h-8 w-px bg-white/10 mx-1"></div>

              <div className="bg-slate-900 p-1 rounded-lg border border-white/10 flex items-center">
                  <button onClick={() => setSortMode('NEWEST')} className={`p-2 rounded hover:bg-white/10 ${sortMode==='NEWEST' ? 'bg-orange-600 text-white' : 'text-slate-400'}`} title="Mới nhất"><SortDesc size={16}/></button>
                  <button onClick={() => setSortMode('OLDEST')} className={`p-2 rounded hover:bg-white/10 ${sortMode==='OLDEST' ? 'bg-orange-600 text-white' : 'text-slate-400'}`} title="Cũ nhất"><SortAsc size={16}/></button>
                  <button onClick={() => setSortMode('LIKES')} className={`p-2 rounded hover:bg-white/10 ${sortMode==='LIKES' ? 'bg-orange-600 text-white' : 'text-slate-400'}`} title="Nổi bật"><Heart size={16}/></button>
                  <button onClick={() => setSortMode('MANUAL')} className={`p-2 rounded hover:bg-white/10 ${sortMode==='MANUAL' ? 'bg-orange-600 text-white' : 'text-slate-400'}`} title="Kéo thả thủ công"><GripVertical size={16}/></button>
              </div>
              
              <button onClick={handleDeleteAll} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 border border-red-900 transition-all shadow-lg" title="Xóa toàn bộ bài viết">
                  <Ban size={16}/> Clear
              </button>

              <button onClick={toggleLock} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase transition ${board.status === 'OPEN' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                  {board.status === 'OPEN' ? <Unlock size={14}/> : <Lock size={14}/>} {board.status === 'OPEN' ? 'MỞ' : 'KHOÁ'}
              </button>
          </div>
      </div>

      {/* BOARD CONTENT */}
      <div className="pt-[90px] p-4 pb-24">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedNotes.map(n => n.id)} strategy={rectSortingStrategy}>
                  <div className="columns-1 md:columns-3 lg:columns-4 gap-4 space-y-4">
                      {sortedNotes.map((note) => (
                          <SortableItem key={note.id} note={note} isManualMode={sortMode === 'MANUAL'} onApprove={approveNote} onDelete={deleteNote} onLike={likeNote} onEdit={openEditor} setZoomedImage={setZoomedImage}/>
                      ))}
                  </div>
              </SortableContext>
          </DndContext>
      </div>

      <button onClick={() => openEditor(null)} className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.5)] flex items-center justify-center text-white z-40 hover:scale-110 transition-transform active:scale-95 animate-bounce-slow border-4 border-slate-900"><PenTool size={28}/></button>

      {isEditorOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 w-full max-w-xl rounded-[2rem] border-2 border-indigo-500 shadow-2xl p-6 relative animate-in zoom-in duration-300">
                  <button onClick={() => setIsEditorOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white bg-white/10 p-2 rounded-full"><X size={20}/></button>
                  <h3 className="font-black text-white italic uppercase mb-6 text-xl flex items-center gap-2">
                      {editingNote ? <Edit3 size={24} className="text-blue-400"/> : <UserCheck size={24} className="text-indigo-400"/>} 
                      {editingNote ? 'Chỉnh sửa bài viết' : 'Giáo viên thông báo'}
                  </h3>
                  <div className="bg-white text-black rounded-xl overflow-hidden mb-4 border-2 border-slate-700">
                      <ReactQuill theme="snow" value={content} onChange={setContent} modules={{ toolbar: [[{'header':[1,2,false]}], ['bold', 'italic', 'underline', 'strike'], [{'color': []}, {'background': []}], [{'list': 'ordered'}, {'list': 'bullet'}], ['clean']] }} className="h-40" />
                  </div>
                  <div className="flex items-center gap-4 mb-6 bg-slate-800 p-3 rounded-xl border border-white/10">
                      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current.click()} className="bg-slate-700 text-slate-200 px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-600 transition shadow-md"><ImageIcon size={18}/> {uploading ? 'Đang tải...' : 'Thêm Ảnh'}</button>
                      {image && <div className="relative group"><img src={image} className="h-12 w-12 object-cover rounded-lg border-2 border-green-500 shadow-md"/><button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 shadow-sm hover:scale-110 transition"><X size={10}/></button></div>}
                  </div>
                  <button onClick={handleSubmit} disabled={uploading} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-xl text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"><Send size={24}/> {uploading ? 'Đang xử lý ảnh...' : (editingNote ? 'Cập Nhật' : 'Đăng Ngay')}</button>
              </div>
          </div>
      )}

      <Lightbox open={Boolean(zoomedImage)} close={() => setZoomedImage(null)} slides={[{ src: zoomedImage }]} plugins={[Zoom]} zoom={{ maxZoomPixelRatio: 5 }} render={{ buttonPrev: () => null, buttonNext: () => null }} />
    </div>
  );
}