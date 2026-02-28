import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Save, ArrowLeft, Sparkles, Loader2, FileText, Download, LayoutTemplate } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

export default function CreateInitiative() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState('MODAU'); // Tab để chỉnh sửa văn bản

  // 1. DỮ LIỆU ĐẦU VÀO (Giáo viên nhập ý ngắn gọn)
  const [formData, setFormData] = useState({
    title: '',
    thucTrang: '',
    giaiPhapChinh: '',
    hieuQuaKinhTe: '',
    hieuQuaXaHoi: '',
    soTruongApDung: 1,
  });

  // 2. DỮ LIỆU AI TRẢ VỀ (Cấu trúc theo đúng Đề cương)
  const [aiData, setAiData] = useState({
    ly_do: '', muc_dich: '', doi_tuong: '', phuong_phap: '', pham_vi: '',
    co_so_ly_luan: '', thuc_trang: '', cac_bien_phap: '', ket_qua: '',
    ket_luan: '', kien_nghi: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // HÀM GỌI GEMINI AI
  const handleGenerateAI = async () => {
    if (!formData.title) return alert("Vui lòng nhập Tên đề tài!");
    setLoadingAI(true);
    
    try {
        const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
        if (!userConfigDoc.exists()) throw new Error("Chưa nhập API Key Gemini!");
        const config = userConfigDoc.data();
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-1.5-flash" });

        const prompt = `Đóng vai chuyên gia giáo dục tỉnh Lâm Đồng. Viết chi tiết "ĐỀ CƯƠNG SÁNG KIẾN" dài và học thuật dựa trên:
        - Tên đề tài: ${formData.title}
        - Thực trạng cũ: ${formData.thucTrang}
        - Giải pháp thực hiện: ${formData.giaiPhapChinh}
        - Hiệu quả mang lại: Kinh tế (${formData.hieuQuaKinhTe}), Giáo dục (${formData.hieuQuaXaHoi})
        - Đã áp dụng tại: ${formData.soTruongApDung} đơn vị.

        YÊU CẦU ĐẶC BIỆT THEO QĐ 559 LÂM ĐỒNG:
        1. Mục "Kết quả đạt được": Phân tích sâu số liệu làm lợi/tiết kiệm và sự lan tỏa.
        2. Mục "Thực trạng": Nhấn mạnh sự cấp thiết.
        3. Mục "Các biện pháp": Chia làm 3-4 biện pháp rõ ràng, logic. Thể hiện tính cải tiến vượt bậc.

        TRẢ VỀ ĐÚNG CHUỖI JSON (Không dùng markdown \`\`\`json):
        {
          "ly_do": "...", "muc_dich": "...", "doi_tuong": "...", "phuong_phap": "...", "pham_vi": "...",
          "co_so_ly_luan": "...", "thuc_trang": "...", "cac_bien_phap": "...", "ket_qua": "...",
          "ket_luan": "...", "kien_nghi": "..."
        }`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI không trả về JSON hợp lệ.");
        
        setAiData(JSON.parse(jsonMatch[0]));
        setStep(2); // Chuyển sang bước chỉnh sửa
        alert("🎉 AI đã viết xong Đề cương sơ bộ!");

    } catch (error) {
        console.error(error);
        alert("Lỗi AI: " + error.message);
    } finally {
        setLoadingAI(false);
    }
  };

  // HÀM XUẤT FILE WORD
  const handleExportWord = async () => {
    try {
        const response = await fetch('/templates/De_Cuong_Template.docx');
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const zip = new PizZip(arrayBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        // Truyền toàn bộ dữ liệu AI đã được giáo viên chỉnh sửa vào Word
        doc.render({
            ten_sang_kien: formData.title,
            ...aiData // Trải phẳng object aiData vào đây
        });

        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        saveAs(out, `DeCuong_${formData.title.substring(0, 15)}.docx`);

    } catch (error) {
        console.error("Lỗi xuất Word:", error);
        alert("Lỗi xuất Word: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 pb-20">
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 font-bold text-gray-500 hover:text-slate-900"><ArrowLeft/> Quay lại</button>
        <h1 className="text-xl font-black text-indigo-700 uppercase">Cố Vấn Sáng Kiến</h1>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* BƯỚC 1: NHẬP Ý TƯỞNG */}
        {step === 1 && (
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
             <h2 className="font-bold text-lg flex items-center gap-2"><LayoutTemplate/> Cung cấp ý tưởng cốt lõi</h2>
             <p className="text-sm text-slate-500 mb-4">Thầy/Cô chỉ cần gạch đầu dòng ngắn gọn, AI sẽ tự động hành văn và mở rộng thành Đề cương 15-20 trang.</p>
             
             <div>
                <label className="block text-sm font-bold mb-1">Tên đề tài/sáng kiến:</label>
                <input value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} className="w-full border-2 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="VD: Ứng dụng AI..." />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-bold mb-1">Thực trạng (Nỗi đau):</label>
                   <textarea rows={3} value={formData.thucTrang} onChange={e=>setFormData({...formData, thucTrang: e.target.value})} className="w-full border-2 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="VD: Học sinh thụ động, GV mất thời gian..." />
                </div>
                <div>
                   <label className="block text-sm font-bold mb-1">Giải pháp thực hiện:</label>
                   <textarea rows={3} value={formData.giaiPhapChinh} onChange={e=>setFormData({...formData, giaiPhapChinh: e.target.value})} className="w-full border-2 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="VD: Dùng form trắc nghiệm online, tổ chức trò chơi..." />
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl">
                <div>
                   <label className="block text-sm font-bold mb-1">Hiệu quả Kinh tế:</label>
                   <input value={formData.hieuQuaKinhTe} onChange={e=>setFormData({...formData, hieuQuaKinhTe: e.target.value})} className="w-full border p-2 rounded focus:border-indigo-500 outline-none" placeholder="Tiết kiệm bao nhiêu?" />
                </div>
                <div>
                   <label className="block text-sm font-bold mb-1">Hiệu quả Giáo dục:</label>
                   <input value={formData.hieuQuaXaHoi} onChange={e=>setFormData({...formData, hieuQuaXaHoi: e.target.value})} className="w-full border p-2 rounded focus:border-indigo-500 outline-none" placeholder="Tỷ lệ học sinh tiến bộ?" />
                </div>
                <div>
                   <label className="block text-sm font-bold mb-1">Số trường áp dụng:</label>
                   <input type="number" min="1" value={formData.soTruongApDung} onChange={e=>setFormData({...formData, soTruongApDung: e.target.value})} className="w-full border p-2 rounded focus:border-indigo-500 outline-none" />
                </div>
             </div>

             <button onClick={handleGenerateAI} disabled={loadingAI} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition flex justify-center items-center gap-2">
                {loadingAI ? <><Loader2 className="animate-spin" /> Đang soạn Đề cương...</> : <><Sparkles /> Viết Đề Cương Chi Tiết</>}
             </button>
          </div>
        )}

        {/* BƯỚC 2: RÀ SOÁT VÀ CHỈNH SỬA */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <h2 className="font-bold text-lg flex items-center gap-2 text-indigo-700"><FileText/> Rà soát & Chỉnh sửa Đề cương</h2>
                <button onClick={handleExportWord} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition">
                    <Download size={18}/> Xuất File Word
                </button>
             </div>

             {/* MENU CHUYỂN TAB */}
             <div className="flex border-b overflow-x-auto hide-scrollbar">
                <button onClick={()=>setActiveTab('MODAU')} className={`px-6 py-3 font-bold whitespace-nowrap ${activeTab==='MODAU'?'border-b-2 border-indigo-600 text-indigo-600':'text-slate-500'}`}>1. MỞ ĐẦU</button>
                <button onClick={()=>setActiveTab('NOIDUNG')} className={`px-6 py-3 font-bold whitespace-nowrap ${activeTab==='NOIDUNG'?'border-b-2 border-indigo-600 text-indigo-600':'text-slate-500'}`}>2. NỘI DUNG CHÍNH</button>
                <button onClick={()=>setActiveTab('KETLUAN')} className={`px-6 py-3 font-bold whitespace-nowrap ${activeTab==='KETLUAN'?'border-b-2 border-indigo-600 text-indigo-600':'text-slate-500'}`}>3. KẾT LUẬN</button>
             </div>

             {/* KHU VỰC CHỈNH SỬA VĂN BẢN */}
             <div className="p-6 space-y-6 bg-slate-50/50">
                {activeTab === 'MODAU' && (
                    <>
                      <div><label className="font-bold text-sm text-indigo-700">1.1. Lý do chọn đề tài</label><textarea rows={6} value={aiData.ly_do} onChange={e=>setAiData({...aiData, ly_do: e.target.value})} className="w-full mt-1 p-3 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed"/></div>
                      <div><label className="font-bold text-sm text-indigo-700">1.2. Mục đích nghiên cứu</label><textarea rows={3} value={aiData.muc_dich} onChange={e=>setAiData({...aiData, muc_dich: e.target.value})} className="w-full mt-1 p-3 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed"/></div>
                      <div><label className="font-bold text-sm text-indigo-700">1.4. Phương pháp nghiên cứu</label><textarea rows={3} value={aiData.phuong_phap} onChange={e=>setAiData({...aiData, phuong_phap: e.target.value})} className="w-full mt-1 p-3 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed"/></div>
                    </>
                )}
                
                {activeTab === 'NOIDUNG' && (
                    <>
                      <div><label className="font-bold text-sm text-indigo-700">2.2. Thực trạng vấn đề</label><textarea rows={6} value={aiData.thuc_trang} onChange={e=>setAiData({...aiData, thuc_trang: e.target.value})} className="w-full mt-1 p-3 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed"/></div>
                      <div><label className="font-bold text-sm text-indigo-700">2.3. Các biện pháp tiến hành (Rất quan trọng)</label><textarea rows={12} value={aiData.cac_bien_phap} onChange={e=>setAiData({...aiData, cac_bien_phap: e.target.value})} className="w-full mt-1 p-4 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed font-medium text-slate-800 bg-white shadow-inner"/></div>
                      <div><label className="font-bold text-sm text-emerald-700">2.4. Kết quả đạt được (Minh chứng điểm số)</label><textarea rows={8} value={aiData.ket_qua} onChange={e=>setAiData({...aiData, ket_qua: e.target.value})} className="w-full mt-1 p-3 border-2 border-emerald-100 bg-emerald-50 rounded-lg outline-none focus:border-emerald-500 leading-relaxed"/></div>
                    </>
                )}

                {activeTab === 'KETLUAN' && (
                    <>
                      <div><label className="font-bold text-sm text-indigo-700">3.1. Kết luận</label><textarea rows={4} value={aiData.ket_luan} onChange={e=>setAiData({...aiData, ket_luan: e.target.value})} className="w-full mt-1 p-3 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed"/></div>
                      <div><label className="font-bold text-sm text-indigo-700">3.2. Kiến nghị</label><textarea rows={4} value={aiData.kien_nghi} onChange={e=>setAiData({...aiData, kien_nghi: e.target.value})} className="w-full mt-1 p-3 border rounded-lg outline-none focus:border-indigo-500 leading-relaxed"/></div>
                    </>
                )}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}