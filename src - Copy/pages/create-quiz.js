import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle, Sparkles, X, Loader2, List, CheckSquare, Type, BrainCircuit, Upload, BookOpen, Image as ImageIcon, Users, Calculator, Info, Clock } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";


// [SỬA ĐỔI] KHÔNG CẤU HÌNH CỐ ĐỊNH Ở ĐÂY NỮA
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dcnsjzq0i/image/upload"; 
const UPLOAD_PRESET = "gameedu"; 

export default function CreateQuiz() {
  const router = useRouter();
  const { id } = router.query;
  const fileInputRef = useRef(null);
  const qImgRef = useRef(null);
  const aImgRef = useRef(null);
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState({ qIndex: -1, aIndex: -1, type: '' });

  // State AI
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSource, setAiSource] = useState('');
  const [aiLevel, setAiLevel] = useState('Lớp 10');
  
  const [matrix, setMatrix] = useState({
    tn_biet: 0, tn_hieu: 0, tn_vd: 0, 
    ds_count: 0, ds_biet: 0, ds_hieu: 0, ds_vd: 0, 
    tl_biet: 0, tl_hieu: 0, tl_vd: 0, 
  });

  // Dữ liệu đề thi
  const [title, setTitle] = useState('');
  const [assignedClass, setAssignedClass] = useState('');
  const [duration, setDuration] = useState(45);
  
  const [scoreConfig, setScoreConfig] = useState({
    p1: 6, 
    p3: 1  
  });

  const [questions, setQuestions] = useState([
    { id: Date.now(), type: 'MCQ', part: 1, q: '', img: '', a: ['', '', '', ''], aImages: ['', '', '', ''], correct: 0 }
  ]);

  const scoreStats = useMemo(() => {
    const p1Count = questions.filter(q => q.type === 'MCQ').length;
    const p2Count = questions.filter(q => q.type === 'TF').length;
    const p3Count = questions.filter(q => q.type === 'SA').length;

    return {
      p1Count,
      p2Count,
      p3Count,
      p1PerQ: p1Count > 0 ? (scoreConfig.p1 / p1Count).toFixed(2) : 0,
      p3PerQ: p3Count > 0 ? (scoreConfig.p3 / p3Count).toFixed(2) : 0,
      p2Total: p2Count * 1, 
      totalScore: parseFloat(scoreConfig.p1) + (p2Count * 1) + parseFloat(scoreConfig.p3)
    };
  }, [questions, scoreConfig]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (id && user) {
      getDoc(doc(firestore, "quizzes", id)).then(snap => {
        if(snap.exists()) {
            const data = snap.data();
            setTitle(data.title);
            setAssignedClass(data.assignedClass || '');
            setDuration(data.duration || 45);
            if (data.scoreConfig) setScoreConfig(data.scoreConfig);
            
            const loadedQs = data.questions.map(q => ({
                ...q,
                img: q.img || '',
                aImages: q.aImages || ['', '', '', '']
            }));
            setQuestions(loadedQs);
        }
      });
    }
  }, [id, user]);

  // --- CÁC HÀM XỬ LÝ ---
  const handleImageUpload = async (file) => {
    if (!file) return null;
    setImgUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        setImgUploading(false);
        return data.secure_url;
    } catch (error) { console.error(error); setImgUploading(false); return null; }
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await handleImageUpload(file);
    if (!url) return;
    const newQs = [...questions];
    const { qIndex, aIndex, type } = uploadTarget;
    if (type === 'QUESTION') newQs[qIndex].img = url;
    else if (type === 'ANSWER') {
        if (!newQs[qIndex].aImages) newQs[qIndex].aImages = ['', '', '', ''];
        newQs[qIndex].aImages[aIndex] = url;
    }
    setQuestions(newQs);
    e.target.value = null;
  };

  const triggerUpload = (qIdx, aIdx = -1, type = 'QUESTION') => {
    setUploadTarget({ qIndex: qIdx, aIndex: aIdx, type });
    if (type === 'QUESTION') qImgRef.current.click(); else aImgRef.current.click();
  };

  const removeImage = (qIdx, aIdx = -1, type = 'QUESTION') => {
    const newQs = [...questions];
    if (type === 'QUESTION') newQs[qIdx].img = '';
    else newQs[qIdx].aImages[aIdx] = '';
    setQuestions(newQs);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: e.target.result });
        const parsedQuestions = parseDocxContent(result.value);
        if (parsedQuestions.length > 0) {
            setQuestions(prev => [...prev, ...parsedQuestions]);
            alert(`✅ Đã nhập ${parsedQuestions.length} câu hỏi!`);
        } else alert("⚠️ Không tìm thấy câu hỏi.");
      } catch (error) { alert("Lỗi đọc file Word!"); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null; 
  };

  const parseDocxContent = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = Array.from(doc.body.children);
    let currentPart = 0; const newQuestions = []; let currentQ = null;
    const partRegex = /\[P([1-3])\]/i;
    const questionRegex = /^(Câu\s+\d+[:.]?)\s*(.*)/i; 
    const pushCurrentQ = () => {
        if (currentQ) {
            if (currentQ.type === 'MCQ') while(currentQ.a.length < 4) currentQ.a.push("");
            newQuestions.push(currentQ); currentQ = null;
        }
    };
    elements.forEach(el => {
        let text = el.textContent.trim(); let innerHTML = el.innerHTML; 
        const partMatch = text.match(partRegex);
        if (partMatch) { pushCurrentQ(); currentPart = parseInt(partMatch[1]); return; }
        const qMatch = text.match(questionRegex);
        if (qMatch) {
            pushCurrentQ(); const qContent = qMatch[2]; 
            if (currentPart === 1) currentQ = { id: Date.now() + Math.random(), type: 'MCQ', part: 1, q: qContent, a: [], aImages: [], correct: 0 };
            else if (currentPart === 2) currentQ = { id: Date.now() + Math.random(), type: 'TF', part: 2, q: qContent, items: [] };
            else if (currentPart === 3) currentQ = { id: Date.now() + Math.random(), type: 'SA', part: 3, q: qContent, correct: '' };
            return;
        }
        if (currentQ) {
            if (currentQ.type === 'MCQ') {
                const ansMatch = text.match(/^([A-D])\.\s*(.*)/i);
                if (ansMatch) {
                    currentQ.a.push(ansMatch[2]);
                    if (innerHTML.includes('<u>') || text.includes('Gạch chân')) currentQ.correct = currentQ.a.length - 1;
                }
            } else if (currentQ.type === 'TF') {
                const itemMatch = text.match(/^([a-d])\)\s*(.*)/i);
                if (itemMatch) {
                    let isTrue = false;
                    if (innerHTML.includes('<u>') || text.toLowerCase().includes('đúng')) isTrue = true;
                    currentQ.items.push({ text: itemMatch[2], isTrue });
                }
            } else if (currentQ.type === 'SA') {
                const keyMatch = text.match(/^Key:\s*(.*)/i);
                if (keyMatch) currentQ.correct = keyMatch[1];
            }
        }
    });
    pushCurrentQ(); return newQuestions;
  };

  // [QUAN TRỌNG] HÀM GỌI AI ĐÃ ĐƯỢC SỬA ĐỂ LẤY CẤU HÌNH TỪ DATABASE
  const handleGenerateAI = async () => {
    if (!aiTopic) return alert("Thầy chưa nhập chủ đề!");
    const countTN = parseInt(matrix.tn_biet) + parseInt(matrix.tn_hieu) + parseInt(matrix.tn_vd);
    const countDS = parseInt(matrix.ds_count);
    const countTL = parseInt(matrix.tl_biet) + parseInt(matrix.tl_hieu) + parseInt(matrix.tl_vd);
    if (countTN + countDS + countTL === 0) return alert("Vui lòng nhập số lượng câu hỏi!");
    
    setAiLoading(true);
    try {
       // 1. LẤY CẤU HÌNH TỪ FIRESTORE (Thay vì dùng biến cứng)
       const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
       if (!userConfigDoc.exists()) {
           throw new Error("Chưa tìm thấy cấu hình API Key. Vui lòng vào trang Cấu hình để cập nhật.");
       }
       const config = userConfigDoc.data();
       const apiKey = config.geminiKey;
       // Nếu không có model trong DB thì dùng bản mặc định 1.5-flash
       const modelName = config.geminiModel || "gemini-1.5-flash"; 

       if (!apiKey) throw new Error("Chưa nhập API Key trong phần Cấu hình!");

       // 2. KHỞI TẠO AI VỚI KEY ĐỘNG
       const dynamicGenAI = new GoogleGenerativeAI(apiKey);
       const model = dynamicGenAI.getGenerativeModel({ model: modelName });

      const prompt = `
        Đóng vai chuyên gia giáo dục soạn đề thi tất cả các môn trong chương trình GDPT 2018.
        Tuyệt đối bám sát vào sách giáo khoa hiện hành của Bộ GDĐT Việt Nam. 
        Lời dẫn câu hỏi phải rõ ràng, dễ hiểu, ngắn gọn. Không được sử dụng từ ngữ như theo sách giáo khoa, theo tài liệu tham khảo,...
        Câu hỏi trắc nghiệm không được có đáp án là "Tất cả các đáp án trên/không đáp án nào đúng","Cả A,B đúng",...
        Viết code python/c++,... không được dùng dấu nháy đơn, nháy kép trong câu hỏi và câu trả lời.
        Chủ đề: ${aiTopic}. Trình độ: ${aiLevel}. Tài liệu: ${aiSource}
        HÃY TẠO DANH SÁCH CÂU HỎI THEO MA TRẬN SAU:
        - PHẦN 1 (Trắc nghiệm): Tổng ${countTN} câu (${matrix.tn_biet} Biết, ${matrix.tn_hieu} Hiểu, ${matrix.tn_vd} Vận dụng).
        - PHẦN 2 (Đúng/Sai chùm): Tổng ${matrix.ds_count} câu lớn. Mỗi câu 4 ý (${matrix.ds_biet} Biết, ${matrix.ds_hieu} Hiểu, ${matrix.ds_vd} Vận dụng).
        - PHẦN 3 (Trả lời ngắn): Tổng ${countTL} câu (${matrix.tl_biet} Biết, ${matrix.tl_hieu} Hiểu, ${matrix.tl_vd} Vận dụng).
        OUTPUT JSON (Mảng duy nhất):
        [
            { "type": "MCQ", "part": 1, "q": "...", "a": ["A", "B", "C", "D"], "correct": 0 },
            { "type": "TF", "part": 2, "q": "...", "items": [ { "text": "...", "isTrue": true }, ... ] },
            { "type": "SA", "part": 3, "q": "...", "correct": "..." }
        ]`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiQuestions = JSON.parse(cleanText).map(q => ({
          ...q, id: Date.now() + Math.random(), a: q.a || ['', '', '', ''], aImages: [], items: q.items || [], correct: q.correct ?? ''
      }));
      setQuestions([...questions, ...aiQuestions]);
      setShowAiModal(false);
      setMatrix({ tn_biet: 0, tn_hieu: 0, tn_vd: 0, ds_count: 0, ds_biet: 0, ds_hieu: 0, ds_vd: 0, tl_biet: 0, tl_hieu: 0, tl_vd: 0 });
      alert(`🎉 Đã tạo thành công ${aiQuestions.length} câu hỏi!`);
    } catch (error) { 
        console.error(error);
        alert("Lỗi AI: " + error.message); 
    } finally { 
        setAiLoading(false); 
    }
  };

  const addQuestion = (type) => {
    const newId = Date.now();
    let newQ = { id: newId, q: '', img: '' };
    if (type === 'MCQ') newQ = { ...newQ, type: 'MCQ', part: 1, a: ['', '', '', ''], aImages: ['', '', '', ''], correct: 0 };
    else if (type === 'TF') newQ = { ...newQ, type: 'TF', part: 2, items: [{ text: '', isTrue: false }, { text: '', isTrue: false }, { text: '', isTrue: false }, { text: '', isTrue: false }] };
    else if (type === 'SA') newQ = { ...newQ, type: 'SA', part: 3, correct: '' };
    setQuestions([...questions, newQ]);
  };
  const updateQuestion = (index, field, value) => { const newQs = [...questions]; newQs[index][field] = value; setQuestions(newQs); };
  const updateMCQAnswer = (qIndex, aIndex, value) => { const newQs = [...questions]; newQs[qIndex].a[aIndex] = value; setQuestions(newQs); };
  const updateTFItem = (qIndex, itemIndex, field, value) => { const newQs = [...questions]; newQs[qIndex].items[itemIndex][field] = value; setQuestions(newQs); };
  const removeQuestion = (index) => { if (questions.length > 1 && confirm("Xóa câu hỏi này?")) setQuestions(questions.filter((_, i) => i !== index)); };

  const handleSave = async () => {
    if (!title) return alert("Chưa nhập tên bài thi!");
    if (!assignedClass) return alert("Chưa nhập tên Lớp áp dụng!");
    if (imgUploading) return alert("Đang tải ảnh...");
    
    setLoading(true);
    try {
      const quizData = { 
          title, 
          assignedClass, 
          duration: parseInt(duration) || 45, 
          scoreConfig,
          authorId: user.uid, 
          questions, 
          updatedAt: serverTimestamp(), 
          status: 'OPEN' 
      };
      if (id) await updateDoc(doc(firestore, "quizzes", id), quizData);
      else { quizData.createdAt = serverTimestamp(); await addDoc(collection(firestore, "quizzes"), quizData); }
      router.push('/dashboard');
    } catch (e) { alert("Lỗi lưu: " + e.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans text-slate-900">
      <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" ref={qImgRef} onChange={onFileChange} className="hidden" />
      <input type="file" accept="image/*" ref={aImgRef} onChange={onFileChange} className="hidden" />

      {/* MODAL AI */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
            <div className="bg-[#15803d] p-5 text-white flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2"><BrainCircuit /> AI SOẠN ĐỀ (MA TRẬN MỚI)</h2>
              <button onClick={() => setShowAiModal(false)}><X size={24}/></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><label className="block text-sm font-bold text-[#15803d] mb-1">1. Chủ đề:</label><input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="VD: Mạng máy tính..." className="w-full border p-2.5 rounded-lg outline-none focus:border-emerald-500" /></div>
                <div><label className="block text-sm font-bold text-[#15803d] mb-1">2. Trình độ:</label><select value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} className="w-full border p-2.5 rounded-lg"><option>Lớp 1</option><option>Lớp 2</option><option>Lớp 3</option><option>Lớp 4</option><option>Lớp 5</option><option>Lớp 6</option><option>Lớp 7</option><option>Lớp 8</option><option>Lớp 9</option><option>Lớp 10</option><option>Lớp 11</option><option>Lớp 12</option></select></div>
              </div>
              <div><label className="block text-sm font-bold text-[#15803d] mb-1 flex items-center gap-2">3. Nguồn tài liệu:</label><textarea value={aiSource} onChange={(e) => setAiSource(e.target.value)} placeholder="Dán nội dung bài học vào đây..." className="w-full border p-2 rounded-lg h-16 text-sm outline-none focus:border-emerald-500"/></div>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-[#15803d] uppercase">4. Ma trận câu hỏi:</label>
                <div className="bg-white p-3 rounded-lg border border-blue-500">
                    <div className="text-blue-600 font-bold text-sm mb-2">P1: Trắc nghiệm</div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_biet} onChange={(e)=>setMatrix({...matrix, tn_biet: e.target.value})} /></div>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_hieu} onChange={(e)=>setMatrix({...matrix, tn_hieu: e.target.value})} /></div>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold w-12">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_vd} onChange={(e)=>setMatrix({...matrix, tn_vd: e.target.value})} /></div>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-500">
                    <div className="flex items-center justify-between mb-2"><span className="text-red-600 font-bold text-sm">P2: Đúng / Sai</span><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-700">Số câu lớn:</span><input type="number" min="0" className="w-16 border-2 border-red-200 p-1 rounded text-center font-black text-red-600" value={matrix.ds_count} onChange={(e)=>setMatrix({...matrix, ds_count: e.target.value})} /></div></div>
                    <div className="bg-red-50 p-2 rounded border border-red-100"><div className="text-[10px] text-red-500 font-bold mb-1 uppercase">Phân bổ ý con (a,b,c,d):</div><div className="grid grid-cols-3 gap-4"><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Ý Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_biet} onChange={(e)=>setMatrix({...matrix, ds_biet: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Ý Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_hieu} onChange={(e)=>setMatrix({...matrix, ds_hieu: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_vd} onChange={(e)=>setMatrix({...matrix, ds_vd: e.target.value})} /></div></div></div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-green-500">
                    <div className="text-green-700 font-bold text-sm mb-2">P3: Trả lời ngắn</div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_biet} onChange={(e)=>setMatrix({...matrix, tl_biet: e.target.value})} /></div>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_hieu} onChange={(e)=>setMatrix({...matrix, tl_hieu: e.target.value})} /></div>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold w-12">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_vd} onChange={(e)=>setMatrix({...matrix, tl_vd: e.target.value})} /></div>
                    </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowAiModal(false)} className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">Hủy</button>
              <button onClick={handleGenerateAI} disabled={aiLoading} className="bg-[#15803d] hover:bg-emerald-800 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg disabled:opacity-70 transition">{aiLoading ? <><Loader2 className="animate-spin"/> Đang tạo...</> : <><Sparkles size={18}/> TẠO ĐỀ NGAY</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-8 sticky top-0 bg-slate-50/95 backdrop-blur z-20 py-4 border-b border-slate-200">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-slate-900 font-bold"><ArrowLeft /> Quay lại</button>
        <div className="flex gap-3">
          <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow transition"><Upload size={18} /> Upload Word</button>
          <button onClick={() => setShowAiModal(true)} className="flex items-center gap-2 bg-[#15803d] hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-bold shadow transition animate-pulse"><Sparkles size={18} /> AI Soạn Đề</button>
          <button onClick={handleSave} disabled={loading || imgUploading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition">{loading || imgUploading ? <Loader2 className="animate-spin"/> : <><Save size={18} /> Lưu Đề Thi</>}</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        
        {/* KHUNG THÔNG TIN CƠ BẢN */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tên bài kiểm tra</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-3xl font-black border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-2 placeholder-slate-300" placeholder="Nhập tên bài kiểm tra..." />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lớp áp dụng */}
              <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Users size={14}/> Lớp áp dụng</label>
                  <input 
                    value={assignedClass} 
                    onChange={(e) => setAssignedClass(e.target.value)} 
                    className="w-full text-lg font-bold border-2 border-slate-100 rounded-lg p-3 focus:border-indigo-500 outline-none text-indigo-700 placeholder-indigo-200" 
                    placeholder="VD: 10A1, 12A5" 
                  />
              </div>
              
              {/* Thời gian làm bài */}
              <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Clock size={14}/> Thời gian làm bài (Phút)</label>
                  <input 
                    type="number" min="1"
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)} 
                    className="w-full text-lg font-bold border-2 border-slate-100 rounded-lg p-3 focus:border-indigo-500 outline-none text-orange-600 placeholder-slate-300 text-center" 
                    placeholder="45" 
                  />
              </div>
          </div>
        </div>

        {/* KHUNG CẤU HÌNH ĐIỂM */}
        <div className="bg-gradient-to-r from-slate-50 to-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Calculator size={100} /></div>
            <h3 className="font-black text-slate-700 flex items-center gap-2 mb-4 uppercase text-sm"><Calculator size={18} /> Cấu trúc điểm ({scoreStats.totalScore} điểm)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-2"><span className="text-blue-700 font-bold text-sm">P1: Trắc nghiệm</span><span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p1Count} câu</span></div>
                    <div className="flex items-center gap-2">
                        <input type="number" min="0" step="0.5" className="w-full border-2 border-blue-200 rounded-lg p-2 font-bold text-blue-900 text-center focus:border-blue-500 outline-none" value={scoreConfig.p1} onChange={(e) => setScoreConfig({...scoreConfig, p1: e.target.value})} />
                        <span className="text-xs font-bold text-blue-400 whitespace-nowrap">Tổng điểm</span>
                    </div>
                    <div className="mt-2 text-xs text-blue-500 text-center font-medium">~ {scoreStats.p1PerQ} đ/câu</div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 opacity-80">
                    <div className="flex justify-between items-center mb-2"><span className="text-red-700 font-bold text-sm">P2: Đúng/Sai</span><span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p2Count} câu lớn</span></div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 justify-center"><span className="text-red-500 font-bold text-sm">Theo quy tắc GDPT</span><Info size={14} className="text-red-300"/></div>
                    <div className="mt-2 text-xs text-red-400 text-center font-medium">(Mỗi câu lớn tối đa 1.0đ)</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <div className="flex justify-between items-center mb-2"><span className="text-green-700 font-bold text-sm">P3: Trả lời ngắn</span><span className="bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p3Count} câu</span></div>
                    <div className="flex items-center gap-2">
                        <input type="number" min="0" step="0.5" className="w-full border-2 border-green-200 rounded-lg p-2 font-bold text-green-900 text-center focus:border-green-500 outline-none" value={scoreConfig.p3} onChange={(e) => setScoreConfig({...scoreConfig, p3: e.target.value})} />
                        <span className="text-xs font-bold text-green-400 whitespace-nowrap">Tổng điểm</span>
                    </div>
                    <div className="mt-2 text-xs text-green-500 text-center font-medium">~ {scoreStats.p3PerQ} đ/câu</div>
                </div>
            </div>
        </div>

        {/* DANH SÁCH CÂU HỎI */}
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group transition hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-2 items-center">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${q.type === 'MCQ' ? 'bg-blue-100 text-blue-700' : q.type === 'TF' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {q.type === 'MCQ' ? 'P1. Trắc nghiệm' : q.type === 'TF' ? 'P2. Đúng / Sai' : 'P3. Trả lời ngắn'}
                </span>
                <span className="font-bold text-gray-400">Câu {qIndex + 1}</span>
              </div>
              <button onClick={() => removeQuestion(qIndex)} className="text-gray-300 hover:text-red-500 p-2 transition"><Trash2 size={18} /></button>
            </div>

            <div className="relative mb-6">
                <div className="flex gap-2">
                    <textarea value={q.q} onChange={(e) => updateQuestion(qIndex, 'q', e.target.value)} className="flex-1 text-lg font-medium bg-slate-50 p-4 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 resize-none border border-transparent focus:border-indigo-200" placeholder={q.type === 'TF' ? "Nhập lời dẫn..." : "Nhập câu hỏi..."} rows={3} />
                    <div className="flex flex-col gap-2">
                        <button onClick={() => triggerUpload(qIndex, -1, 'QUESTION')} className="p-3 bg-slate-100 hover:bg-indigo-100 rounded-xl transition text-slate-500 hover:text-indigo-600" title="Thêm ảnh câu hỏi"><ImageIcon size={20} /></button>
                    </div>
                </div>
                {q.img && (
                    <div className="mt-3 relative w-fit group/img">
                        <img src={q.img} className="h-40 w-auto rounded-lg border shadow-sm object-contain bg-slate-100" />
                        <button onClick={() => removeImage(qIndex, -1, 'QUESTION')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition shadow-md"><X size={14} /></button>
                    </div>
                )}
            </div>

            {q.type === 'MCQ' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.a.map((ans, aIndex) => (
                        <div key={aIndex} className={`flex flex-col gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${q.correct === aIndex ? 'border-green-500 bg-green-50' : 'border-slate-100 hover:border-blue-200'}`} onClick={() => updateQuestion(qIndex, 'correct', aIndex)}>
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${q.correct === aIndex ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>{q.correct === aIndex && <CheckCircle size={14} />}</div>
                                <input value={ans} onChange={(e) => updateMCQAnswer(qIndex, aIndex, e.target.value)} className="flex-1 bg-transparent outline-none font-medium" placeholder={`Đáp án ${String.fromCharCode(65 + aIndex)}`}/>
                                <button onClick={(e) => { e.stopPropagation(); triggerUpload(qIndex, aIndex, 'ANSWER'); }} className="text-slate-400 hover:text-indigo-600 p-1"><ImageIcon size={16} /></button>
                            </div>
                            {q.aImages?.[aIndex] && (
                                <div className="ml-9 relative w-fit group/aimg">
                                    <img src={q.aImages[aIndex]} className="h-20 w-auto rounded border bg-white" />
                                    <button onClick={(e) => { e.stopPropagation(); removeImage(qIndex, aIndex, 'ANSWER'); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/aimg:opacity-100"><X size={12} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {q.type === 'TF' && (
                <div className="border rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 gap-2 font-bold text-xs text-slate-500 uppercase"><div className="col-span-8 pl-2">Nội dung ý con</div><div className="col-span-2 text-center">Đúng</div><div className="col-span-2 text-center">Sai</div></div>
                    <div className="divide-y divide-slate-100">
                        {q.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-slate-50">
                                <div className="col-span-8 flex items-center gap-2">
                                    <span className="bg-slate-200 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0">{String.fromCharCode(97 + idx)}</span>
                                    <input value={item.text} onChange={(e) => updateTFItem(qIndex, idx, 'text', e.target.value)} className="w-full bg-transparent outline-none border-b border-transparent focus:border-orange-300 px-1 py-1" />
                                </div>
                                <div className="col-span-2 flex justify-center"><button onClick={() => updateTFItem(qIndex, idx, 'isTrue', true)} className={`w-8 h-8 rounded border-2 flex items-center justify-center transition ${item.isTrue === true ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-300'}`}>Đ</button></div>
                                <div className="col-span-2 flex justify-center"><button onClick={() => updateTFItem(qIndex, idx, 'isTrue', false)} className={`w-8 h-8 rounded border-2 flex items-center justify-center transition ${item.isTrue === false ? 'bg-red-500 border-red-500 text-white' : 'border-gray-200 text-gray-300'}`}>S</button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {q.type === 'SA' && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <label className="block text-xs font-bold text-green-700 uppercase mb-2">Đáp án chính xác:</label>
                    <input value={q.correct} onChange={(e) => updateQuestion(qIndex, 'correct', e.target.value)} className="w-full border-2 border-green-200 p-3 rounded-lg focus:border-green-500 outline-none font-bold text-green-900 placeholder-green-300" />
                </div>
            )}
          </div>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sticky bottom-6">
            <button onClick={() => addQuestion('MCQ')} className="py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 shadow-sm"><List size={20}/> Thêm Trắc Nghiệm (P1)</button>
            <button onClick={() => addQuestion('TF')} className="py-4 bg-white border-2 border-dashed border-red-300 text-red-600 rounded-xl font-bold hover:bg-red-50 transition flex items-center justify-center gap-2 shadow-sm"><CheckSquare size={20}/> Thêm Đúng/Sai (P2)</button>
            <button onClick={() => addQuestion('SA')} className="py-4 bg-white border-2 border-dashed border-green-300 text-green-600 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 shadow-sm"><Type size={20}/> Thêm Trả Lời Ngắn (P3)</button>
        </div>
      </main>
    </div>
  );
}