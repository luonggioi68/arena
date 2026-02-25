import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import mammoth from 'mammoth';
import { 
    ArrowLeft, Sparkles, Download, Loader2, BookOpen, Settings, 
    CheckSquare, Square, FileText, Target, BrainCircuit, Upload, Link as LinkIcon, Users
} from 'lucide-react';

const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];

export default function LessonPlanner() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  
  // --- STATES CẤU HÌNH ĐẦU VÀO ---
  const [subject, setSubject] = useState('Tin học');
  const [grade, setGrade] = useState('12');
  const [lessonName, setLessonName] = useState('');
  const [duration, setDuration] = useState(2);
  const [studentCount, setStudentCount] = useState(35); 

  // Năng lực, Nội dung & Tệp đính kèm
  const [competencies, setCompetencies] = useState(''); 
  const [lessonLink, setLessonLink] = useState(''); 
  const [sgkContent, setSgkContent] = useState('');
  
  const [pdfData, setPdfData] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [wordName, setWordName] = useState('');

  // Tùy biến GV
  const [additionalEquipment, setAdditionalEquipment] = useState('');
  const [allowGroupWork, setAllowGroupWork] = useState(true);
  const [allowWorksheet, setAllowWorksheet] = useState(true);
  
  // --- STATES AI & KẾT QUẢ ---
  const [loading, setLoading] = useState(false);
  const [resultMarkdown, setResultMarkdown] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
    });
    return () => unsubscribe();
  }, [router]);

  const handlePdfUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.type !== "application/pdf") return alert("Hệ thống chỉ hỗ trợ đọc file PDF!");
      if (file.size > 10 * 1024 * 1024) return alert("Dung lượng file không được vượt quá 10MB!");

      setPdfName(file.name);
      setWordName(''); 
      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result.split(',')[1];
          setPdfData({ inlineData: { data: base64String, mimeType: "application/pdf" } });
      };
      reader.readAsDataURL(file);
  };

  const handleWordUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.name.endsWith('.docx')) return alert("Hệ thống chỉ hỗ trợ file Word định dạng .docx!");
      
      setWordName(file.name);
      setPdfName(''); 
      setPdfData(null);

      const reader = new FileReader();
      reader.onload = async (event) => {
          const arrayBuffer = event.target.result;
          try {
              const result = await mammoth.extractRawText({ arrayBuffer });
              setSgkContent(result.value); 
          } catch (err) {
              alert("Lỗi đọc file Word: " + err.message);
          }
      };
      reader.readAsArrayBuffer(file);
  };

  const handleGenerateLessonPlan = async () => {
    if (!lessonName.trim()) return alert("Vui lòng nhập Tên bài học!");
    if (!sgkContent.trim() && !pdfData && !lessonLink.trim()) return alert("Vui lòng cung cấp Nguồn dữ liệu!");

    setLoading(true);
    setResultMarkdown('');

    try {
        const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
        if (!userConfigDoc.exists() || !userConfigDoc.data().geminiKey) {
            throw new Error("Chưa cấu hình Gemini API Key trong menu Cấu Hình!");
        }
        
        const config = userConfigDoc.data();
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        
        const selectedModel = config.geminiModel || "gemini-1.5-pro";
        const model = genAI.getGenerativeModel({ model: selectedModel });

        const defaultEquipment = "Máy tính, máy chiếu, SGK.";
        const finalEquipment = additionalEquipment ? `${defaultEquipment}, ${additionalEquipment}` : defaultEquipment;

        const hasCompetencies = competencies.trim().length > 0;
        const nlSoText = hasCompetencies ? `* **Năng lực số:** ${competencies.trim()}` : "";
        
        const integrationRule = `
5. QUY TẮC TÍCH HỢP SƯ PHẠM VÀO "HOẠT ĐỘNG 2: HÌNH THÀNH KIẾN THỨC":
   ${hasCompetencies ? `- Bắt buộc lồng ghép diễn giải "Năng lực số" vào mục "a) Mục tiêu" của Hoạt động 2.` : ""}
   ${allowGroupWork ? `- Bắt buộc tổ chức THẢO LUẬN NHÓM (Căn cứ sĩ số ${studentCount} HS để chia nhóm phù hợp) trong phần "d) Tổ chức thực hiện" của Hoạt động 2.` : "- TUYỆT ĐỐI KHÔNG chia nhóm, chỉ làm việc cá nhân."}
   ${allowWorksheet ? `- Thiết kế và yêu cầu học sinh sử dụng PHIẾU HỌC TẬP trong Hoạt động 2 hoặc Hoạt động 3, đồng thời xuất chi tiết Phiếu ở phần Phụ lục.` : "- KHÔNG thiết kế và không dùng Phiếu học tập."}`;

        const prompt = `
Bạn là một Trợ lý Giáo viên ${subject} chuyên nghiệp, nhiệm vụ chính là chuẩn hóa và nâng cấp "Kế hoạch bài dạy" theo Công văn 5512 (GDPT 2018).

**THÔNG TIN BÀI DẠY (ĐẦU VÀO):**
- Môn học: ${subject} lớp ${grade}
- Tên bài học: ${lessonName}
- Năng lực số: """${competencies}"""
- Thiết bị dạy học và Học liệu: """${finalEquipment}"""
- Link tham khảo: """${lessonLink}"""
- **NỘI DUNG GỐC (SGK/PDF HOẶC KHBD cũ):** """\n${sgkContent}\n"""

**QUY TẮC SỐNG CÒN (BẮT BUỘC TUÂN THỦ 100%):**
1. KẾT QUẢ BẮT BUỘC PHẢI BẮT ĐẦU NGAY bằng dòng "### **I. MỤC TIÊU**". Tuyệt đối không chào hỏi, không sinh ra Tên bài học ở đầu.
2. XỬ LÝ NỘI DUNG GỐC: Nếu đầu vào là Giáo án cũ, hãy giữ nguyên chuyên môn. Nếu là SGK/Link, hãy copy y xì đúc tên các mục lớn làm Hoạt động 2.1, 2.2 và copy nguyên văn bài tập vào phần Luyện tập/Vận dụng.
3. BỐI CẢNH: Lớp học có đúng ${studentCount} học sinh.
4. BẢNG BIỂU (TABLE): Bắt buộc kẻ bảng Markdown nếu có nội dung dạng bảng.
5. QUY TẮC CÁC MỤC A, B, C, D: KHÔNG SỬ DỤNG DẤU CHẤM TRÒN (BULLET) CHO CÁC MỤC a, b, c, d. Viết in đậm liền lề trái. Đảm bảo trước mỗi mục a, b, c, d luôn là 1 dòng trống.
${integrationRule}

**TEMPLATE KHBD CẦN TUÂN THỦ (Định dạng Markdown):**
### **I. MỤC TIÊU**
**1. Kiến thức:**
* (Liệt kê kiến thức trọng tâm)
**2. Năng lực:**
* **Năng lực chung:** Tự chủ và tự học; Giao tiếp và hợp tác; Giải quyết vấn đề và sáng tạo.
* **Năng lực đặc thù:** (Năng lực đặc thù môn ${subject}).
${nlSoText}
**3. Phẩm chất:**
* (Trách nhiệm, Trung thực, Chăm chỉ...).

### **II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU**
* **Thiết bị:** ${finalEquipment}
* **Học liệu:** SGK...

### **III. TIẾN TRÌNH DẠY HỌC**

#### **Hoạt động 1: Mở đầu**

**a) Mục tiêu:** ...

**b) Nội dung:** ...

**c) Sản phẩm:** ...

**d) Tổ chức thực hiện:**
* **B1: Chuyển giao nhiệm vụ:** ...
* **B2: Thực hiện nhiệm vụ:** ...
* **B3: Báo cáo, thảo luận:** ...
* **B4: Kết luận, nhận định:** ...

#### **Hoạt động 2: Hình thành kiến thức mới**
#### **Hoạt động 2.1: [Tên mục 1]**

**a) Mục tiêu:** ... (Lồng ghép diễn giải Năng lực số vào đây nếu có)

**b) Nội dung:** ...

**c) Sản phẩm:** ...

**d) Tổ chức thực hiện:**
* **B1, B2, B3, B4** ... (Thể hiện rõ hoạt động chia nhóm hoặc dùng phiếu học tập tại đây)

*(Các hoạt động Luyện tập, Vận dụng trình bày tương tự 4 bước)*

---
### **PHỤ LỤC: PHIẾU HỌC TẬP**
*(Chỉ hiển thị nếu được yêu cầu thiết kế)*
        `;

        const apiContent = [prompt];
        if (pdfData) apiContent.push(pdfData);

        const result = await model.generateContent(apiContent);
        let textResult = result.response.text();

        // 1. Chặn AI sinh tiêu đề thừa, cắt phần đầu lấy từ "I. MỤC TIÊU"
        const targetStart = "### **I. MỤC TIÊU**";
        const startIndex = textResult.indexOf(targetStart);
        if (startIndex !== -1) {
            textResult = textResult.substring(startIndex);
        }

        // 2. Xóa các dấu chấm tròn (bullet *, -) phía trước mục a,b,c,d để nó đứng sát lề
        textResult = textResult.replace(/^\s*[\*\-]\s*\*\*(a\)|b\)|c\)|d\))\s*(.*?)\*\*/gm, '**$1 $2**');
        textResult = textResult.replace(/([^\n])\s*\n?\*\*(a\)|b\)|c\)|d\))\s*(.*?)\*\*/g, '$1\n\n**$2 $3**');

        setResultMarkdown(textResult);

    } catch (error) {
        console.error(error);
        alert("Lỗi tạo giáo án: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  // HÀM XUẤT FILE WORD - ĐÃ THÊM MSO TAGS ĐỂ ÉP MARGINS CHUẨN XÁC 100%
  const exportToWord = () => {
      if (!resultMarkdown) return;
      const header = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
              <meta charset='utf-8'>
              <title>Giao An</title>
              <style>
                  /* ÉP BUỘC WORD NHẬN DIỆN KHỔ A4 VÀ MARGINS BẰNG MSO TAGS */
                  @page Section1 {
                      size: 595.3pt 841.9pt; /* Kích thước chuẩn A4 */
                      margin: 42.5pt 42.5pt 42.5pt 56.7pt; /* Top: 1.5cm, Right: 1.5cm, Bottom: 1.5cm, Left: 2cm */
                      mso-header-margin: 35.4pt;
                      mso-footer-margin: 35.4pt;
                      mso-paper-source: 0;
                  }
                  div.Section1 { page: Section1; }
                  
                  /* Font Times New Roman 12pt, Dãn dòng Single (line-height: 1) */
                  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1; text-align: justify; }
                  
                  h2 { font-size: 12pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-top: 12pt; margin-bottom: 6pt; }
                  h5 { font-size: 12pt; font-weight: bold; text-align: center; margin-top: 0; margin-bottom: 16pt; }
                  h3 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 12pt; margin-bottom: 6pt; }
                  h4 { font-size: 12pt; font-weight: bold; font-style: italic; margin-top: 12pt; margin-bottom: 6pt; }
                  p, li { font-size: 12pt; line-height: 1; margin-top: 3pt; margin-bottom: 3pt; }
                  ul { padding-left: 20pt; margin-top: 3pt; margin-bottom: 3pt; }
                  hr { border: 0; border-bottom: 1px solid #000; margin: 20pt 0; }
                  
                  table { width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 10pt; }
                  table, th, td { border: 1px solid black; }
                  th { font-weight: bold; background-color: #f2f2f2; text-align: center; padding: 5pt; }
                  td { padding: 5pt; text-align: left; vertical-align: top; }
              </style>
          </head>
          <body>
          <div class="Section1">
      `;
      const footer = "</div></body></html>";
      
      const htmlContent = document.getElementById("markdown-export-area").innerHTML;
      const sourceHTML = header + htmlContent + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `KHBD_${subject}_Lop${grade}_${lessonName || 'BaiHoc'}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
  };

  const cleanLessonName = lessonName ? lessonName.trim().replace(/^(BÀI:\s*BÀI\s*|BÀI:\s*|BÀI\s*)/i, 'BÀI ') : 'TÊN BÀI HỌC';

  return (
    <div className="min-h-screen bg-[#0f172a] font-sans flex flex-col h-screen overflow-hidden text-slate-200">
      
      <header className="h-[70px] bg-[#1e293b]/90 backdrop-blur border-b border-white/10 px-6 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-4">
             <button onClick={() => router.push('/dashboard')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition"><ArrowLeft size={20}/></button>
             <div>
                <h1 className="text-xl font-black text-white uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">AI SOẠN KHBD</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Format Word Chuẩn Hành Chính (Trái 2cm, Khác 1.5cm)</p>
             </div>
         </div>
         {resultMarkdown && (
             <button onClick={exportToWord} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition">
                 <Download size={16}/> Tải file Word
             </button>
         )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* CỘT TRÁI: CẤU HÌNH */}
          <div className="w-full lg:w-[450px] bg-[#020617] border-r border-white/10 overflow-y-auto p-6 custom-scrollbar shrink-0">
              <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Settings size={18}/> Tham số bài dạy</h2>
              
              <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">Khối lớp</label>
                          <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-white font-bold">
                              {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">Môn học</label>
                          <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-white font-bold">
                              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Tên bài học</label>
                      <input value={lessonName} onChange={e=>setLessonName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-white font-bold" placeholder="VD: Bài 15: Tạo màu cho chữ..."/>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">Thời lượng (Số tiết)</label>
                          <input type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-white font-bold"/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1"><Users size={12}/> Sĩ số học sinh</label>
                          <input type="number" min="1" value={studentCount} onChange={e=>setStudentCount(e.target.value)} className="w-full bg-slate-900 border border-emerald-900/50 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-white font-bold"/>
                      </div>
                  </div>

                  {/* CHỈ NHẬP NĂNG LỰC SỐ */}
                  <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                          <Target size={14}/> Năng lực số (Bỏ trống nếu không dùng)
                      </label>
                      <textarea 
                          value={competencies} 
                          onChange={e=>setCompetencies(e.target.value)} 
                          rows={2} 
                          className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl outline-none focus:border-emerald-500 text-emerald-300 text-sm font-medium" 
                          placeholder="Dán mã Năng lực số vào đây..."
                      />
                  </div>

                  {/* KHUNG NẠP DỮ LIỆU ĐA NGUỒN */}
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-blue-500/30 space-y-4">
                      <label className="block text-xs font-black text-blue-400 uppercase flex items-center gap-1">
                          <BookOpen size={16}/> Nguồn dữ liệu (Chọn 1 trong 3)
                      </label>

                      <div>
                          <label className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 mb-1.5"><FileText size={12}/> 1. Nâng cấp: Tải Giáo án Word (Bơm Năng lực)</label>
                          <input type="file" id="wordUpload" accept=".docx" onChange={handleWordUpload} className="hidden" />
                          <label htmlFor="wordUpload" className="flex items-center justify-center gap-2 w-full bg-[#020617] border border-emerald-900 hover:border-emerald-500 text-emerald-400 py-2 rounded-lg cursor-pointer transition text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                              {wordName ? 'Đã tải KHBD cũ: ' + wordName : 'Chọn KHBD Word chưa có Năng lực số'}
                          </label>
                      </div>

                      <div className="flex items-center gap-2 opacity-30">
                          <div className="flex-1 h-px bg-slate-700"></div><span className="text-[9px] font-bold">HOẶC DÙNG SGK</span><div className="flex-1 h-px bg-slate-700"></div>
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1.5"><Upload size={12}/> 2. Soạn mới: Tải trang sách PDF SGK</label>
                          <input type="file" id="pdfUpload" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
                          <label htmlFor="pdfUpload" className="flex items-center justify-center gap-2 w-full bg-[#020617] border border-blue-900 hover:border-blue-500 text-blue-400 py-2 rounded-lg cursor-pointer transition text-sm">
                              {pdfName ? 'Đã tải SGK: ' + pdfName : 'Bấm để chọn file PDF (< 10MB)'}
                          </label>
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1.5"><LinkIcon size={12}/> 3. Soạn mới: Dán Link bài học</label>
                          <input 
                              value={lessonLink} 
                              onChange={e=>setLessonLink(e.target.value)} 
                              className="w-full bg-[#020617] border border-blue-900 p-2.5 rounded-lg outline-none focus:border-blue-500 text-blue-300 text-sm placeholder:text-slate-600" 
                              placeholder="Dán link Vietjack, Loigiaihay..."
                          />
                      </div>
                  </div>

                  {/* KHUNG TÙY CHỌN SƯ PHẠM */}
                  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
                      <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-widest">Quy định Sư phạm</label>
                      
                      <div className="space-y-3">
                          <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-300">Tổ chức Hoạt động Nhóm</span>
                              <button onClick={()=>setAllowGroupWork(!allowGroupWork)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${allowGroupWork ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowGroupWork ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                          </div>
                          
                          <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-300">Thiết kế Phiếu học tập</span>
                              <button onClick={()=>setAllowWorksheet(!allowWorksheet)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${allowWorksheet ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowWorksheet ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                          </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/10">
                          <label className="block text-xs font-bold text-slate-400 mb-2">Bổ sung Thiết bị/Học liệu</label>
                          <input value={additionalEquipment} onChange={e=>setAdditionalEquipment(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-white text-sm" placeholder="VD: Loa, Bảng phụ..."/>
                      </div>
                  </div>

                  <button onClick={handleGenerateLessonPlan} disabled={loading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2 mt-4">
                      {loading ? <Loader2 className="animate-spin"/> : <Sparkles size={20}/>} {loading ? 'AI ĐANG BIÊN SOẠN...' : 'XỬ LÝ GIÁO ÁN'}
                  </button>
              </div>
          </div>

          {/* CỘT PHẢI: HIỂN THỊ KẾT QUẢ VỚI HEADER VÀ CSS CHUẨN XÁC MỚI */}
          <div className="flex-1 bg-slate-300 overflow-y-auto relative p-4 md:p-8 custom-scrollbar">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <div className="relative mb-6">
                          <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-30 animate-pulse"></div>
                          <BrainCircuit size={80} className="text-emerald-600 relative z-10 animate-bounce"/>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-widest text-slate-700 mb-2">AI Đang thực thi</h3>
                      <p className="text-sm font-bold">Đang ép lề chuẩn A4 (Trái 2cm, Các lề khác 1.5cm)...</p>
                  </div>
              ) : resultMarkdown ? (
                  <div 
                      className="bg-white p-8 md:p-14 rounded shadow-2xl max-w-4xl mx-auto min-h-full text-black" 
                      id="markdown-export-area"
                  >
                      {/* HEADER TĨNH CHUẨN XÁC THEO HÌNH ẢNH YÊU CẦU MỚI (KHÔNG CẦN NHẬP) */}
                      <div id="static-header" style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt', marginBottom: '16pt' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16pt', border: 'none' }}>
                              <tbody>
                                  <tr>
                                      <td style={{ textAlign: 'left', border: 'none', padding: '0', width: '50%' }}>
                                          <p style={{ margin: '0 0 4pt 0', fontSize: '12pt' }}>Tuần: .......................................</p>
                                      </td>
                                      <td style={{ textAlign: 'left', border: 'none', padding: '0', width: '50%' }}>
                                          <p style={{ margin: '0 0 4pt 0', fontSize: '12pt' }}>Ngày soạn: .......................................</p>
                                      </td>
                                  </tr>
                                  <tr>
                                      <td style={{ textAlign: 'left', border: 'none', padding: '0' }}>
                                          <p style={{ margin: '0', fontSize: '12pt' }}>Tiết ppct: ...................................</p>
                                      </td>
                                      <td style={{ textAlign: 'left', border: 'none', padding: '0' }}>
                                          <p style={{ margin: '0', fontSize: '12pt' }}>Lớp: {grade}</p>
                                      </td>
                                  </tr>
                              </tbody>
                          </table>
                          <h2 style={{ fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', marginBottom: '4pt', marginTop: '16pt' }}>
                              {cleanLessonName}
                          </h2>
                          <h5 style={{ fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', marginTop: 0, marginBottom: '16pt' }}>
                              Thời gian thực hiện: {duration} tiết
                          </h5>
                      </div>

                      <div style={{ fontFamily: "'Times New Roman', serif" }}>
                          <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                  h3: ({node, ...props}) => <h3 style={{fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '12pt', marginBottom: '6pt'}} {...props}/>,
                                  h4: ({node, ...props}) => <h4 style={{fontSize: '12pt', fontWeight: 'bold', fontStyle: 'italic', marginTop: '12pt', marginBottom: '6pt'}} {...props}/>,
                                  p: ({node, ...props}) => <p style={{fontSize: '12pt', lineHeight: '1', margin: '3pt 0', textAlign: 'justify'}} {...props}/>,
                                  ul: ({node, ...props}) => <ul style={{fontSize: '12pt', listStyleType: 'disc', paddingLeft: '20pt', margin: '3pt 0'}} {...props}/>,
                                  ol: ({node, ...props}) => <ol style={{fontSize: '12pt', listStyleType: 'decimal', paddingLeft: '20pt', margin: '3pt 0'}} {...props}/>,
                                  li: ({node, ...props}) => <li style={{marginBottom: '3pt', lineHeight: '1'}} {...props}/>,
                                  strong: ({node, ...props}) => <strong style={{fontWeight: 'bold'}} {...props}/>,
                                  em: ({node, ...props}) => <em style={{fontStyle: 'italic'}} {...props}/>,
                                  table: ({node, ...props}) => <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '10pt', marginBottom: '10pt'}} {...props}/>,
                                  th: ({node, ...props}) => <th style={{border: '1px solid black', padding: '5pt', backgroundColor: '#f2f2f2', fontWeight: 'bold', textAlign: 'center'}} {...props}/>,
                                  td: ({node, ...props}) => <td style={{border: '1px solid black', padding: '5pt', textAlign: 'left', verticalAlign: 'top'}} {...props}/>,
                              }}
                          >
                              {resultMarkdown}
                          </ReactMarkdown>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                      <FileText size={100} className="mb-4"/>
                      <p className="text-xl font-bold uppercase tracking-widest">Bản thảo trống</p>
                  </div>
              )}
          </div>

      </div>
    </div>
  );
}