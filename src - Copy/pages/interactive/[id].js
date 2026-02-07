import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, collection, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { 
    ArrowLeft, Lock, Unlock, Trash2, CheckCircle, Heart, Image as ImageIcon, 
    Shield, Loader2, X, Maximize2, PenTool, Send, UserCheck, GripVertical, 
    SortAsc, SortDesc, Edit3, ZoomIn, Ban, Timer, Play, StopCircle, Hash, CheckSquare, Paperclip, FileText, Download 
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

const UPLOAD_PRESET = "gameedu";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dcnsjzq0i/auto/upload"; // [FIX] Dùng auto/upload

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

    // Render Attachment
    const renderAttachment = () => {
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

    return (
        <div ref={setNodeRef} style={style} className={`relative break-inside-avoid rounded-2xl p-4 shadow-lg border-2 transition-all group ${note.isTeacher ? 'bg-indigo-900/40 border-indigo-500 shadow-indigo-500/20' : (note.approved ? 'bg-slate-900 border-green-900/50' : 'bg-slate-800/50 border-slate-700 opacity-75')}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    {isManualMode && (<div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-white"><GripVertical size={18}/></div>)}
                    <div>
                        <span className={`font-black text-sm uppercase block ${note.isTeacher ? 'text-yellow-400 flex items-center gap-1' : 'text-orange-400'}`}>{note.isTeacher && <UserCheck size={14}/>} {note.author}</span>
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
            
            {renderAttachment()}

            <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                <button onClick={() => onLike(note.id, note.likes)} className="flex items-center gap-1 text-xs font-bold text-pink-400 hover:text-pink-300 transition"><Heart size={14} fill={note.likes > 0 ? "currentColor" : "none"}/> {note.likes || 0}</button>
                {!note.approved ? (<span className="text-[10px] font-bold text-yellow-500 uppercase bg-yellow-500/10 px-2 py-0.5 rounded animate-pulse">Chờ duyệt</span>) : (<span className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1"><CheckCircle size={10}/> Đã hiện</span>)}
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
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // State Đồng hồ
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    if (!id) return;
    const unsubBoard = onSnapshot(doc(firestore, "interactive_boards", id), (d) => setBoard({ id: d.id, ...d.data() }));
    const unsubNotes = onSnapshot(collection(firestore, `interactive_boards/${id}/notes`), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotes(data);
    });
    return () => { unsubBoard(); unsubNotes(); };
  }, [id]);

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

  const handleStartTimer = async () => {
      const millis = timerMinutes * 60 * 1000;
      const endTime = Date.now() + millis;
      await updateDoc(doc(firestore, "interactive_boards", id), { timerEnd: endTime });
      setShowTimerInput(false);
  };

  const handleStopTimer = async () => { await updateDoc(doc(firestore, "interactive_boards", id), { timerEnd: null }); };

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
          setEditingNote(note); setContent(note.content); 
          setAttachment({ url: note.image, type: note.fileType || 'image', name: note.fileName || 'Ảnh đính kèm' });
      } else {
          setEditingNote(null); setContent(''); setAttachment(null);
      }
      setIsEditorOpen(true);
  };

  const handleSubmit = async () => {
      if (!content.trim() && !attachment) return alert("Nội dung trống!");
      setUploading(true);
      try {
          if (editingNote) {
              await updateDoc(doc(firestore, `interactive_boards/${id}/notes`, editingNote.id), { 
                  content, 
                  image: attachment?.url || null, 
                  fileType: attachment?.type || null,
                  fileName: attachment?.name || null,
                  isEdited: true 
              });
          } else {
              await addDoc(collection(firestore, `interactive_boards/${id}/notes`), {
                  content, 
                  image: attachment?.url || null, 
                  fileType: attachment?.type || null,
                  fileName: attachment?.name || null,
                  author: "GIÁO VIÊN", createdAt: serverTimestamp(), approved: true, likes: 0, isTeacher: true, order: notes.length 
              });
          }
          setIsEditorOpen(false); setContent(''); setAttachment(null); setEditingNote(null);
      } catch (e) { alert("Lỗi: " + e.message); } finally { setUploading(false); }
  };

  // [NÂNG CẤP] Upload Đa năng
  const handleFileUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) return alert("⚠️ File quá lớn (>10MB)!");
      setUploading(true);
      const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET);
      try {
          const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
          const data = await res.json();
          if (data.secure_url) {
              setAttachment({ url: data.secure_url, type: data.resource_type, name: file.name });
          }
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

  const handleApproveAll = async () => {
      if (!confirm("Xác nhận DUYỆT hiển thị tất cả bài viết đang chờ?")) return;
      const unapprovedNotes = notes.filter(n => !n.approved);
      if (unapprovedNotes.length === 0) return alert("Tất cả đã được duyệt!");
      try {
          const batch = writeBatch(firestore);
          unapprovedNotes.forEach(note => { const ref = doc(firestore, `interactive_boards/${id}/notes`, note.id); batch.update(ref, { approved: true }); });
          await batch.commit();
          alert(`Đã duyệt hiển thị ${unapprovedNotes.length} bài viết!`);
      } catch (e) { alert("Lỗi: " + e.message); }
  };

  if (!board) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-orange-500">
      <style jsx global>{` .ql-editor img { max-height: 150px !important; width: auto !important; border-radius: 8px; cursor: zoom-in; } .yarl__portal { z-index: 9999 !important; } `}</style>

      {/* HEADER */}
      <div className="h-[70px] bg-slate-950/90 border-b border-orange-600/30 px-6 flex justify-between items-center fixed top-0 w-full z-40 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white"><ArrowLeft size={20}/></button>
              <div className="flex flex-col">
                  {timeLeft ? (
                      <div className={`flex items-center gap-2 font-mono text-2xl font-black ${timeLeft === "HẾT GIỜ" ? "text-red-500 animate-bounce" : "text-green-400"}`}><Timer size={24} className={timeLeft !== "HẾT GIỜ" ? "animate-pulse" : ""}/> {timeLeft}<button onClick={handleStopTimer} className="ml-2 text-slate-500 hover:text-red-500"><StopCircle size={20}/></button></div>
                  ) : (
                      <>
                        <span className="font-black italic uppercase text-lg tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300 hidden md:block">Chiến binh Arena Tương Tác</span>
                        <div className="flex items-center gap-3">
                             <span className="font-bold text-slate-400 text-xs uppercase truncate max-w-[150px]">{board.title}</span>
                             <span className="flex items-center gap-1 bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-xs font-black font-mono tracking-widest shadow-sm"><Hash size={12}/> {board.code}</span>
                        </div>
                      </>
                  )}
              </div>
          </div>
          
          <div className="flex items-center gap-3">
              {!timeLeft && (<button onClick={() => setShowTimerInput(!showTimerInput)} className="flex items-center gap-2 bg-slate-800 text-cyan-400 px-3 py-2 rounded-lg font-bold text-xs hover:bg-slate-700 border border-cyan-900 transition"><Timer size={16}/> Hẹn Giờ</button>)}
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
              
              <button onClick={handleApproveAll} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 border border-green-600/50 transition-all shadow-lg" title="Duyệt tất cả bài chờ"><CheckSquare size={16}/> Duyệt Hết</button>
              <button onClick={handleDeleteAll} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 border border-red-900 transition-all shadow-lg" title="Xóa toàn bộ bài viết"><Ban size={16}/> Clear</button>
              <button onClick={toggleLock} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase transition ${board.status === 'OPEN' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{board.status === 'OPEN' ? <Unlock size={14}/> : <Lock size={14}/>} {board.status === 'OPEN' ? 'MỞ' : 'KHOÁ'}</button>
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
                  <div className="bg-white text-black rounded-xl overflow-hidden mb-4 border-2 border-slate-700"><ReactQuill theme="snow" value={content} onChange={setContent} modules={{ toolbar: [[{'header':[1,2,false]}], ['bold', 'italic', 'underline', 'strike'], [{'color': []}, {'background': []}], [{'list': 'ordered'}, {'list': 'bullet'}], ['clean']] }} className="h-40" /></div>
                  
                  {/* UPLOAD ĐA NĂNG */}
                  <div className="flex items-center gap-4 mb-6 bg-slate-800 p-3 rounded-xl border border-white/10">
                      <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current.click()} className="bg-slate-700 text-slate-200 px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-600 transition shadow-md"><Paperclip size={18}/> {uploading ? 'Đang tải...' : 'Đính kèm'}</button>
                      {attachment && (
                          <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-green-500/50">
                              {attachment.type === 'image' ? <ZoomIn size={16} className="text-green-400"/> : <FileText size={16} className="text-blue-400"/>}
                              <span className="text-xs text-white truncate max-w-[150px]">{attachment.name}</span>
                              <button onClick={() => setAttachment(null)} className="text-red-400 hover:text-red-300"><X size={14}/></button>
                          </div>
                      )}
                      {!attachment && !uploading && <span className="text-xs text-slate-500 italic">Ảnh, PDF, Word, Excel...</span>}
                  </div>

                  <button onClick={handleSubmit} disabled={uploading} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-xl text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"><Send size={24}/> {uploading ? 'Đang xử lý...' : (editingNote ? 'Cập Nhật' : 'Đăng Ngay')}</button>
              </div>
          </div>
      )}

      <Lightbox open={Boolean(zoomedImage)} close={() => setZoomedImage(null)} slides={[{ src: zoomedImage }]} plugins={[Zoom]} zoom={{ maxZoomPixelRatio: 5 }} render={{ buttonPrev: () => null, buttonNext: () => null }} />
    </div>
  );
}