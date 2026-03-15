import React, { useState, useEffect } from 'react';
import { RefreshCw, Lightbulb, CheckCircle, ChevronRight, ChevronLeft, Bot, Download, FileText, Plus, CheckSquare, Loader2, Zap, Edit3, FileCheck, User, Save, Flame, HelpCircle, X, Gamepad2, ShieldAlert } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

import { checkNovelty, generateMeasureContent, generateConclusionAndReport, suggestMeasureIdeas, generateIntroContent, suggestMeasuresList } from '../utils/geminiInitiative';
import { exportInitiativeToWord } from '../utils/exportWord';
import { exportApplicationFormToWord, exportMau03ToWord, exportMau04ToWord } from '../utils/exportForm';

export default function ArenaInitiative() {
  const { user } = useAuthStore();
  const [userConfig, setUserConfig] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(null); 

  const [currentStep, setCurrentStep] = useState(1);
  const [showGuide, setShowGuide] = useState(false);

  const [initiativeData, setInitiativeData] = useState({
    department: "Lâm Đồng", 
    school: "Trường PT DTNT THCS&THPT Tuy Đức", 
    authorName: "", 
    dob: "", 
    jobTitle: "Đại học Sư phạm Tin học", 
    subject: "Tin học", 
    title: "",
    context: "", 
    measures: [
      { id: 1, title: "Giải pháp 1", promptInputs: "", content: "" }
    ],
    introContent: "", 
    conclusionContent: "" 
  });

  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
            const userDoc = await getDoc(doc(firestore, "users", currentUser.uid));
            if (userDoc.exists() && userDoc.data().role === 'teacher') {
                setIsAuthorized(true);
                setInitiativeData(prev => ({...prev, authorName: userDoc.data().name || currentUser.displayName || ""}));
                
                const snap = await getDoc(doc(firestore, "user_configs", currentUser.uid));
                if (snap.exists()) setUserConfig(snap.data());
            } else {
                setIsAuthorized(false);
            }
        } catch (error) {
            console.error("Lỗi xác thực:", error);
            setIsAuthorized(false);
        }
      } else {
          setIsAuthorized(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchExistingInitiative = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        setDocumentId(id);
        try {
          const docRef = doc(firestore, "initiatives", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            // Kiểm tra bảo mật phụ: Đảm bảo không tải nhầm bài của GV khác bằng URL chui
            if (docSnap.data().uid !== auth.currentUser?.uid) {
                alert("Lỗi truy cập: Thầy không có quyền mở sáng kiến này!");
                window.location.href = '/InitiativeManager';
                return;
            }
            setInitiativeData(docSnap.data());
          }
        } catch (error) {
          console.error("Lỗi tải sáng kiến dở dang:", error);
        }
      }
    };
    if (isAuthorized) fetchExistingInitiative();
  }, [isAuthorized]);

  const handleSaveDraft = async () => {
    if (!user) return alert("Thầy cần đăng nhập để lưu!");
    setIsSaving(true);
    try {
      const dataToSave = {
        ...initiativeData,
        uid: user.uid,
        updatedAt: serverTimestamp()
      };

      if (documentId) {
        await updateDoc(doc(firestore, "initiatives", documentId), dataToSave);
        alert("Đã cập nhật bản nháp thành công!");
      } else {
        const docRef = await addDoc(collection(firestore, "initiatives"), dataToSave);
        setDocumentId(docRef.id);
        window.history.pushState({}, '', `${window.location.pathname}?id=${docRef.id}`);
        alert("Đã lưu bản nháp mới thành công!");
      }
    } catch (error) {
      alert("Lỗi khi lưu: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const steps = [
    { num: 1, label: "Ý tưởng & Hồ sơ" },
    { num: 2, label: "Khung giải pháp" },
    { num: 3, label: "Viết chi tiết" },
    { num: 4, label: "Xem & Sửa" },
    { num: 5, label: "Xuất bản" }
  ];

  if (isAuthorized === null) return <div className="min-h-screen bg-[#0a0505] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;
  if (isAuthorized === false) return (
     <div className="min-h-screen bg-[#0a0505] text-white flex flex-col items-center justify-center p-4 text-center">
       <ShieldAlert size={64} className="text-red-500 mb-4 animate-pulse" />
       <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 mb-2 uppercase">Khu Vực Tuyệt Mật</h1>
       <p className="text-slate-400 mb-8 max-w-md">Chỉ huy hiệu Giáo viên mới có thể mở khóa tính năng Arena Sáng Kiến. Học viên vui lòng quay lại.</p>
       <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-slate-800 rounded-xl hover:bg-slate-700 font-bold border border-slate-700 transition-all text-white shadow-lg">Trở về Căn cứ</button>
     </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0505] text-slate-200 p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      {showGuide && <UserGuideModal onClose={() => setShowGuide(false)} />}

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex flex-col items-center justify-center mb-8 relative">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center gap-3 uppercase tracking-wider text-center">
                <Flame className="text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,1)]" size={40} />
                ARENA SÁNG KIẾN
            </h1>
            <p className="text-orange-200 mt-2 font-medium tracking-widest uppercase text-sm drop-shadow-[0_0_5px_rgba(253,186,116,0.5)]">Giải pháp toàn diện cho giáo viên</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
          <button onClick={() => setShowGuide(true)} className="px-5 py-2.5 bg-slate-800 text-yellow-400 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] font-bold flex items-center gap-2 transition-all w-full sm:w-auto justify-center">
            <HelpCircle size={18} /> Hướng dẫn sử dụng
          </button>
          
          <button onClick={handleSaveDraft} disabled={isSaving} className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-bold flex items-center gap-2 hover:from-red-500 hover:to-orange-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all w-full sm:w-auto justify-center">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? "Đang lưu..." : "Lưu bản nháp Firebase"}
          </button>
        </div>
        
        <div className="flex items-center justify-between relative hidden sm:flex mb-10 px-4">
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-slate-800 z-0 rounded-full"></div>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-orange-500 to-red-600 z-0 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{ width: `calc(${((currentStep - 1) / 4) * 100}% - 2rem)` }}></div>
          
          {steps.map((step) => (
            <div key={step.num} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-500 border-2 ${currentStep >= step.num ? 'bg-red-600 border-orange-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.8)] scale-110' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                {currentStep > step.num ? <CheckSquare size={20} /> : step.num}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${currentStep >= step.num ? 'text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'text-slate-600'}`}>{step.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/70 border border-red-500/20 rounded-3xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
          
          {currentStep === 1 && <Step1Idea data={initiativeData} setData={setInitiativeData} nextStep={nextStep} userConfig={userConfig} />}
          {currentStep === 2 && <Step2Outline data={initiativeData} setData={setInitiativeData} nextStep={nextStep} prevStep={prevStep} userConfig={userConfig} />}
          {currentStep === 3 && <Step3MeasuresLoop data={initiativeData} setData={setInitiativeData} nextStep={nextStep} prevStep={prevStep} isLoadingAI={isLoadingAI} setIsLoadingAI={setIsLoadingAI} userConfig={userConfig} />}
          {currentStep === 4 && <Step4Review data={initiativeData} setData={setInitiativeData} nextStep={nextStep} prevStep={prevStep} isLoadingAI={isLoadingAI} setIsLoadingAI={setIsLoadingAI} userConfig={userConfig} />}
          {currentStep === 5 && <Step5Finalize data={initiativeData} prevStep={prevStep} />}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CÁC COMPONENT CON BÊN DƯỚI
// ==========================================
function UserGuideModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-orange-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.3)] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center gap-2 uppercase tracking-wide">
            <Gamepad2 size={24} className="text-orange-500" /> Hướng dẫn tác chiến Arena
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1 bg-slate-800 rounded-lg"><X size={24} /></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar text-slate-300 space-y-6 text-sm md:text-base">
          <div className="bg-orange-950/20 border border-orange-500/30 p-4 rounded-xl">
            <p><strong>Arena Sáng Kiến</strong> là một cỗ máy AI giúp giáo viên thiết kế, viết và xuất bản trọn bộ Hồ sơ Sáng kiến kinh nghiệm.</p>
            <p className="text-yellow-400 font-bold mt-2">⚠️ LƯU Ý: NHỚ BẤM LƯU BẢN NHÁP ĐỂ KHÔNG MẤT DỮ LIỆU</p>
          </div>
          <div className="space-y-3">
            <h3 className="text-orange-400 font-bold uppercase tracking-wider border-l-4 border-orange-500 pl-3">Bước 1: Khởi tạo Ý tưởng & Hồ sơ</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Điền đầy đủ thông tin cá nhân. Thông tin này sẽ được in tự động vào biểu mẫu.</li>
              <li>Bấm <strong className="text-emerald-400">Thẩm định Tính mới</strong> để AI nhận xét xem đề tài có đạt điểm cao không.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-orange-400 font-bold uppercase tracking-wider border-l-4 border-orange-500 pl-3">Bước 2: Xây dựng Khung giải pháp</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Bạn <strong>KHÔNG CẦN TỰ NGHĨ</strong>. Hãy bấm ngay nút <strong className="text-yellow-400">💡 AI Gợi ý giải pháp</strong>.</li>
               <li>Bạn <strong>CÓ GIẢI PHÁP</strong>. Hãy nhập vô ô dưới <strong className="text-yellow-400">Giải pháp. Bấm dấu + thêm nhiều giải pháp.</strong>.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-orange-400 font-bold uppercase tracking-wider border-l-4 border-orange-500 pl-3">Bước 3: Viết chi tiết (Tung Bí Kíp)</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nhập một câu thực tế bạn đã làm: <em>"Tôi tạo mã Code trên Quizizz..."</em></li>
              <li>Bấm <strong className="text-emerald-400">AI Viết giải pháp này</strong>.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-orange-400 font-bold uppercase tracking-wider border-l-4 border-orange-500 pl-3">Bước 4: Xem & Chỉnh Sửa (Live-Edit)</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Bấm <strong className="text-blue-400">⚡ Tự động hoàn thiện Bài</strong> để AI viết nốt phần Mở Đầu và Kết Luận.</li>
              <li>Click chuột trực tiếp vào chữ để gõ thêm, sửa lỗi hoặc xóa dòng <span className="text-red-500 font-bold">[Bổ sung ảnh minh hoạ]</span>.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-orange-400 font-bold uppercase tracking-wider border-l-4 border-orange-500 pl-3">Bước 5: Xuất bản & Đóng gói</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Click tải 4 file Word. Mở file Báo cáo, nhấn <strong>Ctrl + A</strong>, sau đó nhấn <strong>F9</strong> để Mục lục nhảy số trang.</li>
            </ul>
          </div>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950 text-right">
          <button onClick={onClose} className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-[0_0_15px_rgba(239,68,68,0.4)]">Đã Hiểu! Bắt Đầu Ngay</button>
        </div>
      </div>
    </div>
  );
}

function Step1Idea({ data, setData, nextStep, userConfig }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckNovelty = async () => {
    if (!userConfig?.geminiKey) return alert("Thầy cần nhập API Key trước!");
    if (!data.title || !data.context) return alert("Vui lòng nhập Tên đề tài và Bối cảnh!");
    setLoading(true);
    try {
        const resultHTML = await checkNovelty(data.title, data.context, userConfig.geminiKey, userConfig.geminiModel || 'gemini-1.5-pro');
        setFeedback(resultHTML);
    } catch (error) { alert("Lỗi AI: " + error.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700 shadow-inner">
        <h2 className="text-sm font-bold text-orange-400 mb-4 flex items-center gap-2 uppercase tracking-wider"><User size={18}/> THÔNG TIN TÁC GIẢ</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Sở GD&ĐT Tỉnh/Thành</label>
              <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" value={data.department} onChange={(e) => setData({...data, department: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Đơn vị công tác</label>
              <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" value={data.school} onChange={(e) => setData({...data, school: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Họ và tên Giáo viên</label>
              <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" value={data.authorName} onChange={(e) => setData({...data, authorName: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Ngày sinh</label>
              <input type="text" placeholder="VD: 01/01/1990" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" value={data.dob} onChange={(e) => setData({...data, dob: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Trình độ chuyên môn</label>
              <input type="text" placeholder="VD: Đại học Sư phạm..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" value={data.jobTitle} onChange={(e) => setData({...data, jobTitle: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Lĩnh vực SKKN</label>
              <input type="text" placeholder="VD: Tin học, Quản lý..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" value={data.subject} onChange={(e) => setData({...data, subject: e.target.value})} />
            </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-orange-400 uppercase flex items-center gap-2"><Gamepad2 size={16}/> Tên đề tài dự kiến</label>
          <textarea className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" rows="5" value={data.title} onChange={(e) => setData({...data, title: e.target.value})} placeholder="Nhập tên đề tài..." />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-orange-400 uppercase flex items-center gap-2"><Gamepad2 size={16}/> Bối cảnh / Thực trạng</label>
          <textarea className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-white" rows="5" value={data.context} onChange={(e) => setData({...data, context: e.target.value})} placeholder="Nhập thực trạng học sinh..." />
        </div>
      </div>
      {feedback && (
        <div className="bg-purple-900/20 border border-purple-500/30 p-5 rounded-2xl mt-4 text-sm prose prose-invert max-w-none shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <h3 className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Bot size={16}/> Nhận xét từ Giám khảo AI:</h3>
            <div dangerouslySetInnerHTML={{ __html: feedback }} />
        </div>
      )}
      <div className="flex justify-between mt-10 pt-6 border-t border-slate-800/50">
        <button onClick={handleCheckNovelty} disabled={loading} className="px-5 py-3 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-xl hover:bg-purple-600/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center gap-2 text-sm font-bold disabled:opacity-50 transition-all">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />} Thẩm định Tính mới
        </button>
        <button onClick={nextStep} className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all">
          Tiếp tục <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function Step2Outline({ data, setData, nextStep, prevStep, userConfig }) {
  const [isSuggesting, setIsSuggesting] = useState(false);
  const handleAISuggestions = async () => {
    if (!userConfig?.geminiKey) return alert("Cần nhập API Key!");
    if (!data.title) return alert("Thầy cần nhập Tên đề tài ở Bước 1 trước!");
    setIsSuggesting(true);
    try {
        const result = await suggestMeasuresList(data.title, data.context, userConfig.geminiKey, userConfig.geminiModel);
        const lines = result.split('\n').filter(l => l.trim().length > 0);
        const newMeasures = lines.map((l, index) => ({
            id: Date.now() + index,
            title: l.replace(/^[\-\*\d\.\:\s]+/, '').trim(),
            promptInputs: "", content: ""
        }));
        setData({...data, measures: [...data.measures, ...newMeasures]});
    } catch (e) { alert("Lỗi AI: " + e.message); }
    finally { setIsSuggesting(false); }
  }
  const addMeasure = () => setData({...data, measures: [...data.measures, { id: Date.now(), title: "Giải pháp mới", promptInputs: "", content: "" }]});
  const removeMeasure = (indexToRemove) => setData({...data, measures: data.measures.filter((_, index) => index !== indexToRemove)});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h2 className="text-xl font-black text-orange-400 mb-1 uppercase tracking-wider">Khung Giải Pháp Cốt Lõi</h2>
            <p className="text-sm text-slate-400">Xác định các giải pháp chính để công phá đề tài này.</p>
        </div>
        <button onClick={handleAISuggestions} disabled={isSuggesting} className="px-5 py-2.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 rounded-xl hover:bg-yellow-500/20 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] flex items-center gap-2 text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap shadow-inner">
            {isSuggesting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-yellow-400" />} AI Auto-Tạo Khung
        </button>
      </div>
      <div className="space-y-3 bg-slate-900/60 p-6 rounded-2xl border border-slate-700 shadow-inner">
        {data.measures.map((m, index) => (
          <div key={m.id} className="flex gap-3 items-center bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-orange-500/50 transition-colors group shadow-sm">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center font-black text-sm shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              {index + 1}
            </div>
            <input type="text" className="flex-1 bg-transparent border-none outline-none text-base font-medium text-slate-200 focus:text-white" value={m.title} placeholder="Nhập tên giải pháp..." onChange={(e) => {
                 const newMeasures = [...data.measures];
                 newMeasures[index].title = e.target.value;
                 setData({...data, measures: newMeasures});
              }} />
            <button onClick={() => removeMeasure(index)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 p-2 transition-colors"><X size={20}/></button>
          </div>
        ))}
        <button onClick={addMeasure} className="w-full mt-4 py-4 border-2 border-dashed border-slate-700 text-slate-400 rounded-xl hover:border-orange-500 hover:text-orange-400 hover:bg-orange-500/5 text-sm font-bold flex items-center justify-center gap-2 transition-all">
          <Plus size={20} /> Thêm giải pháp mới
        </button>
      </div>
      <div className="flex justify-between mt-10 pt-6 border-t border-slate-800/50">
        <button onClick={prevStep} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"><ChevronLeft size={18} /> Quay lại</button>
        <button onClick={nextStep} className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all">Tiếp tục <ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

function Step3MeasuresLoop({ data, setData, nextStep, prevStep, isLoadingAI, setIsLoadingAI, userConfig }) {
  const [activeTab, setActiveTab] = useState(0);
  const [isSuggesting, setIsSuggesting] = useState(false); 

  const handleGenerateAI = async () => {
    if (!userConfig?.geminiKey) return alert("Thầy cần nhập API Key!");
    setIsLoadingAI(true);
    try {
      const generatedHTML = await generateMeasureContent(data, activeTab, userConfig.geminiKey, userConfig.geminiModel);
      const newMeasures = [...data.measures];
      newMeasures[activeTab].content = generatedHTML;
      setData({...data, measures: newMeasures});
    } catch (e) { alert("Lỗi tạo nội dung: " + e.message); } 
    finally { setIsLoadingAI(false); }
  };

  const handleSuggestIdeas = async () => {
    if (!userConfig?.geminiKey) return;
    setIsSuggesting(true);
    try {
      const suggestions = await suggestMeasureIdeas(data, activeTab, userConfig.geminiKey, userConfig.geminiModel);
      const newMeasures = [...data.measures];
      newMeasures[activeTab].promptInputs = (newMeasures[activeTab].promptInputs ? newMeasures[activeTab].promptInputs + "\n\n" : "") + suggestions;
      setData({...data, measures: newMeasures});
    } catch (e) { alert("Lỗi gợi ý: " + e.message); } 
    finally { setIsSuggesting(false); }
  };

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <div className="mb-8">
        <h2 className="text-xl font-black text-orange-400 mb-1 uppercase tracking-wider">Trang Bị Bí Kíp (Chi Tiết)</h2>
        <p className="text-sm text-slate-400">Truyền thao tác thực tế vào khung, AI sẽ khuếch đại thành văn bản dài.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3 space-y-3">
          {data.measures.map((m, idx) => (
            <button key={m.id} onClick={() => setActiveTab(idx)} className={`w-full flex items-center justify-between text-left p-4 rounded-xl border-2 text-sm font-bold transition-all ${activeTab === idx ? 'bg-orange-950/30 border-orange-500 text-orange-400 shadow-[inset_4px_0_0_#f97316,0_0_15px_rgba(249,115,22,0.15)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}>
              <span className="truncate pr-2">{idx + 1}. {m.title}</span>
              {m.content && <CheckCircle size={18} className="text-emerald-500 shrink-0 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]"/>}
            </button>
          ))}
        </div>
        <div className="w-full md:w-2/3 flex flex-col gap-6">
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
               <h2 className="text-lg font-black text-white flex-1">{data.measures[activeTab].title}</h2>
               <button onClick={handleSuggestIdeas} disabled={isSuggesting || isLoadingAI} className="px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-yellow-500/20 hover:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all">
                  {isSuggesting ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />} Gợi ý thao tác
               </button>
            </div>
            <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-base focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none min-h-[160px] text-slate-200 custom-scrollbar placeholder:text-slate-600 font-medium" placeholder="VD: Nhập cách làm thực tế, phần mềm đã dùng..." value={data.measures[activeTab].promptInputs} onChange={(e) => {
                  const newMeasures = [...data.measures];
                  newMeasures[activeTab].promptInputs = e.target.value;
                  setData({...data, measures: newMeasures});
              }} />
            <div className="flex justify-end mt-5">
              <button onClick={handleGenerateAI} disabled={isLoadingAI || isSuggesting} className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-bold flex items-center gap-2 text-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50">
                {isLoadingAI ? <Loader2 size={20} className="animate-spin" /> : <Bot size={20} />} AI Triển Khai Giải Pháp
              </button>
            </div>
          </div>
          {data.measures[activeTab].content && (
            <div className="bg-slate-950 p-6 rounded-2xl border border-emerald-900/50 shadow-[0_0_20px_rgba(16,185,129,0.1)] animate-fade-in relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
               <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                 <CheckSquare size={16}/> Output AI Sinh Ra
               </h3>
               <div 
                  className="prose prose-invert prose-sm max-w-none text-slate-300 h-64 overflow-y-auto pr-3 custom-scrollbar font-serif text-[11pt]"
                  dangerouslySetInnerHTML={{ __html: data.measures[activeTab].content }}
               />
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between mt-10 pt-6 border-t border-slate-800/50">
        <button onClick={prevStep} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"><ChevronLeft size={18} /> Quay lại</button>
        <button onClick={nextStep} className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all">Tiếp tục <ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

function Step4Review({ data, setData, nextStep, prevStep, isLoadingAI, setIsLoadingAI, userConfig }) {
  const handleGenerateWrapUp = async (isRewrite = false) => {
    if (!userConfig?.geminiKey) return alert("Thầy cần nhập API Key!");
    if (isRewrite && !window.confirm("CẢNH BÁO: Thao tác này sẽ XÓA BỎ toàn bộ nội dung Mở đầu và Kết luận hiện tại để AI viết mới hoàn toàn.\n\nThầy có chắc chắn muốn viết lại không?")) {
        return;
    }
    setIsLoadingAI(true);
    try {
        const [intro, conclusion] = await Promise.all([
            generateIntroContent(data, userConfig.geminiKey, userConfig.geminiModel),
            generateConclusionAndReport(data, userConfig.geminiKey, userConfig.geminiModel)
        ]);
        setData({...data, introContent: intro, conclusionContent: conclusion});
    } catch (e) { alert("Lỗi: " + e.message); } 
    finally { setIsLoadingAI(false); }
  };

  const handleEditContent = (field, index, newHTML) => {
     if (field === 'intro') setData({...data, introContent: newHTML});
     else if (field === 'conclusion') setData({...data, conclusionContent: newHTML});
     else if (field === 'measure') {
         const newMeasures = [...data.measures];
         newMeasures[index].content = newHTML;
         setData({...data, measures: newMeasures});
     }
  };

  return (
    <div className="space-y-6 animate-fade-in text-center py-4 relative">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 relative">
        <div className="flex items-center gap-3">
            <Edit3 size={36} className="text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 uppercase tracking-wider drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">Live Edit - Bản Thảo</h2>
        </div>
        {(data.introContent || data.conclusionContent) && (
            <button onClick={() => handleGenerateWrapUp(true)} disabled={isLoadingAI} className="sm:absolute right-0 px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/50 rounded-xl hover:bg-red-600/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 z-10 mt-2 sm:mt-0" title="AI sẽ xóa bản cũ và viết lại hoàn toàn phần Mở đầu & Kết luận">
                {isLoadingAI ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />} Gacha Viết Lại
            </button>
        )}
      </div>
      
      {!data.introContent && !data.conclusionContent ? (
        <div className="py-12 bg-slate-900/50 rounded-3xl border border-slate-800">
            <p className="text-slate-400 max-w-lg mx-auto mb-8 text-lg">Ghép nối các bộ phận thành vũ khí hoàn chỉnh. Nhấn nút để AI viết Mở Đầu & Kết Luận.</p>
            <button onClick={() => handleGenerateWrapUp(false)} disabled={isLoadingAI} className="px-10 py-4 mx-auto bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(239,68,68,0.5)] text-lg">
              {isLoadingAI ? <Loader2 size={24} className="animate-spin"/> : <Zap size={24} className="fill-white" />} AUTO HOÀN THIỆN (AI)
            </button>
        </div>
      ) : (
        <div className="space-y-6">
            <p className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-xl text-left shadow-inner flex gap-2">
              <span className="text-lg">👉</span> <span><strong>Hướng dẫn chiến đấu:</strong> Click chuột thẳng vào tờ giấy Word bên dưới để gõ, xóa hoặc sửa văn bản. Hãy tìm và xử lý các dòng <span className="text-red-500 font-bold">[Bổ sung ảnh minh hoạ]</span>.</span>
            </p>
            <div className="bg-white text-black p-8 md:p-14 rounded-2xl text-left max-w-4xl mx-auto h-[60vh] overflow-y-auto custom-scrollbar leading-relaxed shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-slate-200" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '14pt' }}>
                <div contentEditable suppressContentEditableWarning onBlur={(e) => handleEditContent('intro', null, e.currentTarget.innerHTML)} className="outline-none focus:bg-orange-50/50 transition-colors p-2 rounded" dangerouslySetInnerHTML={{ __html: data.introContent }} />
                <h3 className="italic font-bold mt-4 p-2" style={{ fontSize: '14pt' }}>2.3. Các giải pháp đã tiến hành...</h3>
                {data.measures.map((m, idx) => (
                    <div key={m.id} className="mt-4 outline-none focus:bg-orange-50/50 transition-colors p-2 rounded" contentEditable suppressContentEditableWarning onBlur={(e) => handleEditContent('measure', idx, e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: `<h4 style="font-weight: bold; margin-top: 12px; margin-bottom: 6px;">2.3.${idx+1}. ${m.title}</h4>` + m.content }} />
                ))}
                <div className="mt-4 outline-none focus:bg-orange-50/50 transition-colors p-2 rounded" contentEditable suppressContentEditableWarning onBlur={(e) => handleEditContent('conclusion', null, e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: data.conclusionContent }} />
            </div>
        </div>
      )}
      <div className="flex justify-between mt-10 pt-6 border-t border-slate-800/50">
        <button onClick={prevStep} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"><ChevronLeft size={18} /> Quay lại</button>
        <button onClick={nextStep} className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all hover:scale-105">Đến Kho Vũ Khí (Xuất File) <ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

function Step5Finalize({ data, prevStep }) {
  const handleExportWord = () => exportInitiativeToWord(data);
  const handleExportForm = () => exportApplicationFormToWord(data);
  const handleExportMau03 = () => exportMau03ToWord(data);
  const handleExportMau04 = () => exportMau04ToWord(data);

  return (
    <div className="space-y-8 animate-fade-in text-center py-12 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="w-28 h-28 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.8)] border-4 border-red-400">
        <Download size={50} className="text-white" />
      </div>
      <h2 className="text-4xl font-black text-white mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] uppercase tracking-wide">Kho Vũ Khí Đã Mở</h2>
      <p className="text-orange-200 max-w-lg mx-auto mb-10 text-lg font-medium">Chúc mừng chiến binh! Toàn bộ Hồ sơ Sáng kiến (Báo cáo, Đơn, Mẫu 03, Mẫu 04) đã được rèn đúc hoàn tất.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto relative z-10">
        <button onClick={handleExportWord} className="p-6 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-3xl hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] font-bold flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-105 border border-orange-400/50 group">
            <FileText size={32} className="group-hover:scale-110 transition-transform" /> <span className="text-lg">TẢI BÁO CÁO SKKN (.DOC)</span><span className="text-xs font-medium text-orange-200 bg-black/20 px-3 py-1 rounded-full">Bản báo cáo dài 20-30 trang</span>
        </button>
        <button onClick={handleExportForm} className="p-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl hover:shadow-[0_0_30px_rgba(219,39,119,0.6)] font-bold flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-105 border border-pink-400/50 group">
            <FileCheck size={32} className="group-hover:scale-110 transition-transform" /> <span className="text-lg">TẢI ĐƠN ĐỀ NGHỊ (.DOC)</span><span className="text-xs font-medium text-pink-200 bg-black/20 px-3 py-1 rounded-full">Đơn xin xét duyệt sáng kiến</span>
        </button>
        <button onClick={handleExportMau03} className="p-6 bg-slate-900 border-2 border-cyan-500/50 text-cyan-400 rounded-3xl hover:bg-cyan-900/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] font-bold flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-105 group">
            <FileText size={32} className="group-hover:scale-110 transition-transform" /> <span className="text-lg">TẢI MẪU SỐ 03 (.DOC)</span><span className="text-xs font-medium text-cyan-200/70 bg-black/40 px-3 py-1 rounded-full">Báo cáo hiệu quả áp dụng</span>
        </button>
        <button onClick={handleExportMau04} className="p-6 bg-slate-900 border-2 border-emerald-500/50 text-emerald-400 rounded-3xl hover:bg-emerald-900/40 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] font-bold flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-105 group">
            <CheckSquare size={32} className="group-hover:scale-110 transition-transform" /> <span className="text-lg">TẢI MẪU SỐ 04 (.DOC)</span><span className="text-xs font-medium text-emerald-200/70 bg-black/40 px-3 py-1 rounded-full">Giấy xác nhận của đơn vị</span>
        </button>
      </div>

      <div className="mt-16 pt-6 border-t border-slate-800 flex justify-center relative z-10">
        <button onClick={prevStep} className="px-8 py-3 bg-slate-900 text-slate-300 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700"><ChevronLeft size={20} /> Trở về rèn đúc lại (Xem & Sửa)</button>
      </div>
    </div>
  );
}