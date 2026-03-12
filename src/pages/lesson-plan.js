import { useState, useEffect } from 'react';
import Head from 'next/head'; // Bổ sung Head cho trang cấm
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import rehypeRaw from 'rehype-raw'; 
import remarkMath from 'remark-math'; 
import rehypeKatex from 'rehype-katex'; 
import 'katex/dist/katex.min.css'; 
import mammoth from 'mammoth';
import { 
    ArrowLeft, Sparkles, Download, Loader2, BookOpen, Settings, 
    CheckSquare, Square, FileText, Target, BrainCircuit, Link as LinkIcon, Users, Monitor, AlignLeft,
    Flame, AlertTriangle, Home // BỔ SUNG ICON BẢO MẬT
} from 'lucide-react';

const MASTER_EMAILS = ["luonggioi68@gmail.com"]; // Thêm quyền Admin gốc
const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];

export default function LessonPlanner() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  
  // STATE MỚI: THEO DÕI QUYỀN GIÁO VIÊN
  const [isTeacher, setIsTeacher] = useState(null); 
  
  // --- STATES CẤU HÌNH ĐẦU VÀO ---
  const [subject, setSubject] = useState('Tin học');
  const [grade, setGrade] = useState('12');
  const [lessonName, setLessonName] = useState('');
  const [duration, setDuration] = useState(2);
  const [studentCount, setStudentCount] = useState(35); 

  // State cho Thiết bị / Học liệu
  const [equipment, setEquipment] = useState('');

  // Năng lực, Nội dung & Tệp đính kèm
  const [competencies, setCompetencies] = useState(''); 
  
  const [rawKnowledge, setRawKnowledge] = useState(''); 
  
  const [sgkContent, setSgkContent] = useState('');
  const [wordName, setWordName] = useState('');

  // Tùy biến GV
  const [allowGroupWork, setAllowGroupWork] = useState(true);
  const [allowWorksheet, setAllowWorksheet] = useState(true);
  
  // --- STATES AI & KẾT QUẢ ---
  const [loading, setLoading] = useState(false);
  const [resultMarkdown, setResultMarkdown] = useState('');

  // LOGIC PHÂN QUYỀN BẢO MẬT
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Vào Firestore check role
        const userDocSnap = await getDoc(doc(firestore, "users", currentUser.uid));
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};
        const checkRole = userData.role === 'teacher' || MASTER_EMAILS.includes(currentUser.email);
        
        setIsTeacher(checkRole);
        setUser({ ...currentUser, ...userData });
      } else {
        // Chưa đăng nhập thì cấm
        setIsTeacher(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // HÀM ĐỌC FILE WORD
  const handleWordUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.name.endsWith('.docx')) return alert("Hệ thống chỉ hỗ trợ file Word định dạng .docx!");
      
      setWordName(file.name);
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
    
    if (!sgkContent.trim() && !rawKnowledge.trim()) {
        return alert("Vui lòng cung cấp Nguồn dữ liệu (Giáo án Word cũ HOẶC Dán nội dung kiến thức)!");
    }

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

        const defaultEquipment = "Máy tính, máy chiếu, SGK";
        const finalEquipment = equipment.trim() ? `${defaultEquipment}, ${equipment.trim()}` : defaultEquipment;

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
- **NỘI DUNG KIẾN THỨC LÝ THUYẾT/BÀI TẬP:** """\n${rawKnowledge}\n"""
- **NỘI DUNG GIÁO ÁN GỐC (nếu có tải lên):** """\n${sgkContent}\n"""

**QUY TẮC SỐNG CÒN (BẮT BUỘC TUÂN THỦ 100%):**
1. KẾT QUẢ BẮT BUỘC PHẢI BẮT ĐẦU NGAY bằng dòng "### **I. MỤC TIÊU**". Tuyệt đối không chào hỏi, không sinh ra Tên bài học ở đầu.
2. XỬ LÝ NỘI DUNG GỐC: 
   - Nếu GV cung cấp "NỘI DUNG KIẾN THỨC LÝ THUYẾT/BÀI TẬP", hãy bóc tách các ý chính trong đó để tạo thành các tiểu mục Hoạt động 2.1, 2.2... Các bài tập đi kèm hãy đưa vào Hoạt động 3 (Luyện tập) và Hoạt động 4 (Vận dụng).
   - Nếu GV cung cấp "NỘI DUNG GIÁO ÁN GỐC", hãy chuẩn hóa nó theo khung 5512, giữ nguyên vẹn nội dung chuyên môn của GV.
3. BỐI CẢNH: Lớp học có đúng ${studentCount} học sinh.
4. BẢNG BIỂU (TABLE): Bắt buộc kẻ bảng Markdown nếu có nội dung dạng bảng.
5. QUY TẮC CÁC MỤC A, B, C, D: KHÔNG SỬ DỤNG DẤU CHẤM TRÒN (BULLET) CHO CÁC MỤC a, b, c, d. Viết in đậm liền lề trái. Đảm bảo trước mỗi mục a, b, c, d luôn là 1 dòng trống.
6. TOÁN HỌC / LÝ / HÓA HỌC: MỌI biểu thức chứa phân số, căn bậc 2, giới hạn (lim), logarit, tích phân... BẮT BUỘC phải được viết bằng mã lệnh LaTeX và kẹp trong cặp dấu $...$ (Ví dụ: $\\sqrt{x^2+1}$, $\\lim_{x \\to 0}$, $\\frac{a}{b}$).
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

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();

        const targetStart = "### **I. MỤC TIÊU**";
        const startIndex = textResult.indexOf(targetStart);
        if (startIndex !== -1) {
            textResult = textResult.substring(startIndex);
        }

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

  const exportToWord = () => {
      if (!resultMarkdown) return;
      
      const exportNode = document.getElementById("markdown-export-area").cloneNode(true);
      
      const katexHtmlElements = exportNode.querySelectorAll('.katex-html');
      katexHtmlElements.forEach(el => el.remove());

      const header = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
              <meta charset='utf-8'>
              <title>Giao An</title>
              <style>
                  @page Section1 {
                      size: 595.3pt 841.9pt; 
                      margin: 42.5pt 42.5pt 42.5pt 56.7pt; 
                      mso-header-margin: 35.4pt;
                      mso-footer-margin: 35.4pt;
                      mso-paper-source: 0;
                  }
                  div.Section1 { page: Section1; }
                  
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
      
      const htmlContent = exportNode.innerHTML;
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

  // MÀN HÌNH CHỜ KIỂM TRA QUYỀN
  if (isTeacher === null) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-bold shadow-[0_0_20px_rgba(249,115,22,0.5)]">
              <Flame className="animate-bounce mr-2" size={30} /> ĐANG QUÉT PHÂN QUYỀN CHIẾN BINH...
          </div>
      );
  }

  // MÀN HÌNH TỪ CHỐI TRUY CẬP CHO HỌC SINH/KHÁCH
  if (isTeacher === false) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col text-center p-4 relative overflow-hidden selection:bg-red-500 selection:text-white">
          <Head><title>Khu Vực Hạn Chế | Arena Edu</title></Head>
          <div className="absolute top-40 left-10 w-72 h-72 bg-red-600/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-40 right-10 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <AlertTriangle className="w-20 h-20 md:w-[100px] md:h-[100px] text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse relative z-10"/>
          <h1 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-4 uppercase tracking-widest relative z-10">Khu Vực Hạn Chế</h1>
          <p className="text-slate-400 mb-10 font-bold tracking-widest text-xs md:text-sm relative z-10 px-4 max-w-lg">Công cụ Soạn Giáo Án AI là vũ khí tuyệt mật. Bạn cần đăng nhập bằng tài khoản <span className="text-red-400 font-black">GIÁO VIÊN</span> để sử dụng.</p>
          <button onClick={() => router.push('/')} className="relative z-10 bg-slate-900/80 hover:bg-cyan-600 text-cyan-400 hover:text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-black transition-all border border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-3 uppercase tracking-widest hover:scale-105 active:scale-95 text-xs md:text-base"><Home size={20}/> Trở Về Căn Cứ</button>
        </div>
      );
  }

  // GIAO DIỆN CHÍNH CHO GIÁO VIÊN
  return (
    <div className="min-h-screen bg-[#050505] font-sans flex flex-col h-screen overflow-hidden text-gray-200 relative">
      
      {/* GLOWING BACKGROUND ORB */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-600/20 blur-[150px] rounded-full pointer-events-none"></div>

      {/* HEADER BỐC LỬA */}
      <header className="h-[70px] bg-black/80 backdrop-blur-md border-b border-red-500/40 shadow-[0_4px_30px_rgba(239,68,68,0.3)] px-6 flex justify-between items-center shrink-0 z-10 relative">
         <div className="flex items-center gap-4">
             <button onClick={() => router.push('/')} className="p-2 bg-gray-900 border border-red-500/30 hover:bg-red-950/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-xl transition-all"><ArrowLeft size={20} className="text-orange-400"/></button>
             <div>
                <h1 className="text-2xl font-black uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600" style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
                    AI SOẠN KẾ HOẠCH BÀI DẠY
                </h1>
                <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest">Chuẩn hóa cấu trúc CV 5512 (GDPT 2018)</p>
             </div>
         </div>
         {resultMarkdown && (
             <button onClick={exportToWord} className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:shadow-[0_0_30px_rgba(239,68,68,0.9)] hover:scale-105 transition-all border border-red-400/50">
                 <Download size={18}/> TẢI BẢN WORD
             </button>
         )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10">
          
          {/* CỘT TRÁI: CẤU HÌNH NEON */}
          <div className="w-full lg:w-[450px] bg-black/60 backdrop-blur-md border-r border-orange-500/30 shadow-[5px_0_30px_rgba(249,115,22,0.1)] overflow-y-auto p-6 custom-scrollbar shrink-0">
              <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest mb-6 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">
                  <Settings size={18}/> Tham số bài dạy
              </h2>
              
              <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Khối lớp</label>
                          <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm transition-all">
                              {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Môn học</label>
                          <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm transition-all">
                              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Tên bài học</label>
                      <input value={lessonName} onChange={e=>setLessonName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm transition-all shadow-inner" placeholder="VD: Bài 15: Phép tính giới hạn..."/>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Thời lượng (Tiết)</label>
                          <input type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm text-center transition-all"/>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Users size={12}/> Sĩ số học sinh</label>
                          <input type="number" min="1" value={studentCount} onChange={e=>setStudentCount(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm text-center transition-all"/>
                      </div>
                  </div>

                  {/* THIẾT BỊ DẠY HỌC BỔ SUNG */}
                  <div>
                      <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Monitor size={14}/> Thiết bị & Học liệu bổ sung
                      </label>
                      <textarea 
                          value={equipment} 
                          onChange={e=>setEquipment(e.target.value)} 
                          rows={2} 
                          className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 text-xs transition-all shadow-inner custom-scrollbar" 
                          placeholder="VD: Loa, Bảng phụ, Tranh ảnh, Phiếu học tập..."
                      />
                  </div>

                  {/* NĂNG LỰC SỐ */}
                  <div>
                      <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Target size={14}/> Năng lực số (Tùy chọn)
                      </label>
                      <textarea 
                          value={competencies} 
                          onChange={e=>setCompetencies(e.target.value)} 
                          rows={2} 
                          className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-300 font-medium text-xs transition-all shadow-inner custom-scrollbar" 
                          placeholder="Dán mã và nội dung Năng lực số vào đây..."
                      />
                  </div>

                  {/* KHUNG NẠP DỮ LIỆU BỐC LỬA */}
                  <div className="bg-gray-950/80 p-5 rounded-xl border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)] transition-all hover:border-orange-500/60 space-y-4">
                      <label className="block text-[11px] font-black text-red-500 uppercase flex items-center gap-1 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">
                          <BookOpen size={16}/> Nguồn dữ liệu (Chọn 1 trong 2)
                      </label>

                      <div>
                          <label className="text-[10px] font-bold text-orange-400/80 flex items-center gap-1 mb-2"><FileText size={12}/> 1. Nâng cấp KHBD cũ</label>
                          <input type="file" id="wordUpload" accept=".docx" onChange={handleWordUpload} className="hidden" />
                          <label htmlFor="wordUpload" className="flex items-center justify-center gap-2 w-full bg-gray-900 border border-orange-500/30 hover:border-orange-500 text-orange-300 hover:text-orange-100 py-2.5 rounded-lg cursor-pointer transition-all text-xs font-bold shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                              {wordName ? 'Đã tải: ' + wordName : 'TẢI LÊN FILE WORD (.DOCX)'}
                          </label>
                      </div>

                      <div className="flex items-center gap-2 opacity-40">
                          <div className="flex-1 h-px bg-orange-500"></div><span className="text-[9px] font-black text-orange-300">HOẶC SOẠN MỚI</span><div className="flex-1 h-px bg-orange-500"></div>
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-orange-400/80 flex items-center gap-1 mb-2">
                              <AlignLeft size={12}/> 2. Dán nội dung kiến thức SGK
                          </label>
                          <textarea 
                              value={rawKnowledge} 
                              onChange={e=>setRawKnowledge(e.target.value)} 
                              rows={4}
                              className="w-full bg-gray-900 border border-orange-500/30 hover:border-orange-500/60 p-3 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 text-xs placeholder:text-gray-600 custom-scrollbar transition-all" 
                              placeholder="Copy đoạn văn bản lý thuyết, bài tập từ SGK và dán vào đây để AI phân chia hoạt động..."
                          />
                      </div>
                  </div>

                  {/* KHUNG TÙY CHỌN SƯ PHẠM */}
                  <div className="bg-gray-950/50 border border-gray-800 p-4 rounded-xl">
                      <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-3">Quy định Sư phạm</label>
                      <div className="space-y-4">
                          <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-300">Tổ chức Hoạt động Nhóm</span>
                              <button onClick={()=>setAllowGroupWork(!allowGroupWork)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${allowGroupWork ? 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gray-700'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowGroupWork ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                          </div>
                          
                          <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-300">Thiết kế Phiếu học tập</span>
                              <button onClick={()=>setAllowWorksheet(!allowWorksheet)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${allowWorksheet ? 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gray-700'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowWorksheet ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                          </div>
                      </div>
                  </div>

                  <button onClick={handleGenerateLessonPlan} disabled={loading} className={`relative w-full py-4 rounded-xl font-black uppercase tracking-widest text-white overflow-hidden group transition-all mt-6 ${loading ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' : 'border border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.6)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] active:scale-95'}`}>
                      {!loading && (
                          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 group-hover:scale-110 transition-transform duration-500"></div>
                      )}
                      <div className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? <Flame className="animate-bounce text-yellow-300" size={22}/> : <Sparkles size={22}/>} 
                          {loading ? 'ĐANG NUNG CHẢY DỮ LIỆU...' : 'XỬ LÝ GIÁO ÁN'}
                      </div>
                  </button>
              </div>
          </div>

          {/* CỘT PHẢI: HIỂN THỊ KẾT QUẢ VỚI BORDER NEON */}
          <div className="flex-1 bg-gray-900/80 overflow-y-auto relative p-4 md:p-8 custom-scrollbar shadow-[inset_10px_0_30px_rgba(0,0,0,0.5)]">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-orange-500">
                      <div className="relative mb-8">
                          <div className="absolute inset-0 bg-gradient-to-t from-red-600 to-yellow-400 blur-[60px] opacity-70 animate-pulse rounded-full w-32 h-32 -ml-8 -mt-8"></div>
                          <Flame size={90} className="text-yellow-400 relative z-10 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"/>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-2" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>LÒ PHẢN ỨNG ĐANG CHẠY</h3>
                      <p className="text-sm font-bold tracking-widest text-orange-200/60 animate-pulse">Đang dàn trang chuẩn 5512 và Render công thức...</p>
                  </div>
              ) : resultMarkdown ? (
                  <div 
                      className="bg-white p-8 md:p-14 rounded-sm shadow-[0_0_40px_rgba(239,68,68,0.3)] border border-red-500/20 max-w-4xl mx-auto min-h-full text-black" 
                      id="markdown-export-area"
                  >
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
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeRaw, rehypeKatex]} 
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
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-60">
                      <div className="relative mb-6">
                          <BookOpen size={120} className="text-gray-800 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]"/>
                      </div>
                      <p className="text-2xl font-black uppercase tracking-[0.2em] text-center text-gray-600 drop-shadow-md">KHAI BÁO DỮ LIỆU<br/><span className="text-sm font-bold tracking-widest text-gray-500">ĐỂ BẮT ĐẦU SOẠN GIÁO ÁN</span></p>
                  </div>
              )}
          </div>

      </div>
    </div>
  );
}