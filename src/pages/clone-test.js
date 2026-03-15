import { useState, useEffect } from 'react';
import Head from 'next/head'; // Bổ sung Head
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
import * as mammoth from 'mammoth'; 
import { 
    ArrowLeft, Sparkles, Download, Loader2, FileText, BrainCircuit, 
    Upload, X, Copy, Flame, AlertTriangle, Home // Bổ sung Icon cảnh báo và Home
} from 'lucide-react';

const MASTER_EMAILS = ["luonggioi68@gmail.com"]; // Thêm quyền Admin gốc
const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];

export default function CloneTestGenerator() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  
  // STATE MỚI: THEO DÕI QUYỀN GIÁO VIÊN
  const [isTeacher, setIsTeacher] = useState(null); 
  
  const [subject, setSubject] = useState('Tin học');
  const [grade, setGrade] = useState('12');
  const [testTitle, setTestTitle] = useState('ĐỀ KIỂM TRA (NHÂN BẢN)');
  const [additionalNote, setAdditionalNote] = useState('');
  
  const [uploadedText, setUploadedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

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

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileType = file.name.split('.').pop().toLowerCase();
      if (!['txt', 'docx', 'pdf'].includes(fileType)) {
          return alert("Hệ thống chỉ hỗ trợ file .txt, .docx, .pdf!");
      }

      setUploadedFileName(file.name);
      setIsExtracting(true);

      try {
          if (fileType === 'txt') {
              const text = await file.text();
              setUploadedText(text);
          } 
          else if (fileType === 'docx') {
              const arrayBuffer = await file.arrayBuffer();
              const result = await mammoth.extractRawText({ arrayBuffer });
              setUploadedText(result.value);
          }
       // Thay đổi dòng 85 trong clone-test.js
else if (fileType === 'pdf') {
    // 1. Chỉ định đường dẫn chi tiết để Turbopack/Webpack tìm thấy file
    const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

    // 2. Thiết lập Worker từ CDN (giữ nguyên logic của bạn)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();

    try {
        // 3. Khởi tạo tác vụ đọc PDF
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        setUploadedText(fullText);
    } catch (pdfError) {
        console.error("Lỗi xử lý nội dung PDF:", pdfError);
        throw new Error("Không thể trích xuất văn bản từ file PDF này.");
    }
}
      } catch (error) {
          console.error("Lỗi đọc file:", error);
          alert("Có lỗi xảy ra khi đọc file!");
          setUploadedFileName('');
      } finally {
          setIsExtracting(false);
          e.target.value = null;
      }
  };

  const clearUploadedFile = () => {
      setUploadedText('');
      setUploadedFileName('');
  };

  const handleCloneTest = async () => {
    if (!testTitle.trim()) return alert("Vui lòng nhập Tiêu đề bài kiểm tra!");
    if (!uploadedText.trim()) return alert("Vui lòng tải lên ĐỀ GỐC để hệ thống phân tích!");

    setLoading(true);
    setResultMarkdown('');

    let competencyGuidance = "";
    if (subject === "Tin học") {
        competencyGuidance = "Sử dụng chính xác các mã NLa, NLb, NLc, NLd, NLe.";
    } else if (subject === "Toán học") {
        competencyGuidance = "Sử dụng các mã TD (Tư duy), MH (Mô hình hóa), GQVĐ (Giải quyết vấn đề), GT (Giao tiếp), CC (Công cụ).";
    } else if (["Vật lí", "Hóa học", "Sinh học"].includes(subject)) {
        competencyGuidance = "Sử dụng các mã NT (Nhận thức khoa học), TH (Tìm hiểu), VD (Vận dụng).";
    } else if (["Lịch sử", "Địa lí", "GDCD"].includes(subject)) {
        competencyGuidance = "Sử dụng các mã Nhận thức (NT), Tìm hiểu (TH), Vận dụng (VD).";
    } else if (subject === "Ngữ văn") {
        competencyGuidance = "Sử dụng các mã Năng lực ngôn ngữ (NLNN), Năng lực văn học (NLVH).";
    } else {
        competencyGuidance = `Sử dụng các kí hiệu mã năng lực đặc thù chuẩn của môn ${subject} theo GDPT 2018.`;
    }

    try {
        const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
        if (!userConfigDoc.exists() || !userConfigDoc.data().geminiKey) {
            throw new Error("Chưa cấu hình Gemini API Key trong menu Cấu Hình!");
        }
        
        const config = userConfigDoc.data();
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        const selectedModel = config.geminiModel || "gemini-1.5-pro"; 
        const model = genAI.getGenerativeModel({ model: selectedModel });

     const prompt = `
Bạn là một Chuyên gia Khảo thí giáo dục. Nhiệm vụ của bạn là đọc một Đề thi gốc, phân tích cấu trúc của nó, và TẠO RA MỘT ĐỀ THI MỚI TƯƠNG ĐƯƠNG (Nhân bản) chuẩn form cấu trúc 2025 của Bộ GD&ĐT.

**THÔNG TIN CƠ BẢN:**
- Môn: ${subject} - Lớp: ${grade}
- Tiêu đề đề mới: ${testTitle}
- Ghi chú thêm từ giáo viên: """${additionalNote}"""

**ĐỀ GỐC CẦN PHÂN TÍCH VÀ NHÂN BẢN:**
"""
${uploadedText}
"""

**YÊU CẦU THỰC THI CHÍNH (SỐNG CÒN):**
1. **Phân tích đề gốc:** Đọc đề gốc để xác định tổng số câu Trắc nghiệm, Đúng/Sai, Trả lời ngắn, Tự luận. Xác định chủ đề và mức độ (Biết, Hiểu, Vận dụng).
2. **Sáng tác đề mới (Clone):** Tạo ra các câu hỏi MỚI HOÀN TOÀN bám sát phạm vi kiến thức, độ khó và có SỐ LƯỢNG CÂU HỎI MỖI PHẦN Y HỆT đề gốc.
3. **Quy ước tính điểm:** Tự tính toán điểm sao cho tổng điểm toàn bài là 10.0đ (Gợi ý: Trắc nghiệm 0.25đ/câu, Đúng/Sai 0.25đ/ý, Trả lời ngắn 0.25đ-0.5đ/câu, còn lại là Tự luận).

**QUY TẮC ĐỊNH DẠNG (SỐNG CÒN):**
- SỐ THỨ TỰ CÂU: MỖI PHẦN (I, II, III, IV) BẮT BUỘC PHẢI ĐÁNH SỐ LẠI TỪ CÂU 1.
- ĐÁP ÁN: Thêm dấu sao (*) viết liền trước đáp án/ý ĐÚNG. KHÔNG thêm (*) vào chữ Đ/S ở bảng đáp án.
- ÉP BUỘC XUỐNG DÒNG: Các phương án (A, B, C, D) và (a, b, c, d) PHẢI xuống dòng (Enter 2 lần).
- TRẢ LỜI NGẮN: Ghi "Key: đáp án".
- CODE & CÔNG THỨC: Bọc code bằng \`\`\`python. Công thức Toán/Lý/Hóa phức tạp dùng LaTeX kẹp trong $...$ (có khoảng trắng trước và sau thẻ $) ví dụ: Căn bậc 2, mũ, luỹ thừa, lim,phân số,...; Công thức đơn giản không dùng latex như x = 5, y = mx + c,-5,x, {2,5,6},... thì không cần dùng $...$.

**YÊU CẦU TRẢ VỀ 4 PHẦN CHÍNH XÁC THEO HTML SAU:**

### **PHẦN 1: MA TRẬN ĐỀ KIỂM TRA**
BẮT BUỘC dùng khối HTML dưới đây. TỰ TÍNH TOÁN cộng tổng số câu, điểm, tỉ lệ % và điền vào thay cho "...".
<table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse:collapse; text-align:center; font-size: 11pt;">
  <thead>
    <tr>
      <th rowspan="3">TT</th>
      <th rowspan="3">Chủ đề/Chương</th>
      <th rowspan="3">Nội dung/đơn vị kiến thức</th>
      <th colspan="12">Mức độ đánh giá</th>
      <th colspan="3" rowspan="2">Tổng số câu/ý</th>
      <th rowspan="3">Tỉ lệ % điểm</th>
    </tr>
    <tr>
      <th colspan="3">Nhiều lựa chọn</th>
      <th colspan="3">Đúng - Sai</th>
      <th colspan="3">Trả lời ngắn</th>
      <th colspan="3">Tự luận</th>
    </tr>
    <tr>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
    </tr>
  </thead>
  <tbody>
    <tr style="font-weight:bold;">
      <td colspan="3">Tổng số câu / ý</td>
      <td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td></td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="3">Tổng số điểm</td>
      <td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>10.0</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="3">Tỉ lệ %</td>
      <td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>100%</td>
    </tr>
  </tbody>
</table>

### **PHẦN 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA**
**QUY TẮC ĐIỀN BẢNG ĐẶC TẢ (SỐNG CÒN - PHẠM LỖI SẼ BỊ PHẠT):**
1. Các hàng nội dung phải khớp 100% với Ma trận.
2. Ở cột điền "Số câu hỏi", BẮT BUỘC ghi số lượng câu, vị trí câu, và PHẢI DÙNG THẺ <br> ĐỂ XUỐNG DÒNG GHI MÃ NĂNG LỰC. 
   - **Mẫu chuẩn bắt buộc:** 5 (Câu 6,7,8,9,10) <br> (NLa)
   - *Hướng dẫn mã năng lực môn này:* ${competencyGuidance}
3. Tính toán chính xác 3 hàng "Tổng số câu", "Tổng số điểm", "Tỉ lệ %" ở cuối bảng.

BẮT BUỘC dùng khối HTML dưới đây:
<table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse:collapse; text-align:center; font-size: 11pt;">
  <thead>
    <tr>
      <th rowspan="4">TT</th>
      <th rowspan="4">Chủ đề/Chương</th>
      <th rowspan="4">Nội dung/đơn vị kiến thức</th>
      <th rowspan="4">Yêu cầu cần đạt</th>
      <th colspan="12">Số câu hỏi ở các mức độ đánh giá</th>
    </tr>
    <tr>
      <th colspan="9">TNKQ</th>
      <th colspan="3" rowspan="2">Tự luận</th>
    </tr>
    <tr>
      <th colspan="3">Nhiều lựa chọn</th>
      <th colspan="3">Đúng - Sai</th>
      <th colspan="3">Trả lời ngắn</th>
    </tr>
    <tr>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
      <th>Biết</th><th>Hiểu</th><th>Vận dụng</th>
    </tr>
  </thead>
  <tbody>
    <tr style="font-weight:bold;">
      <td colspan="4">Tổng số câu</td>
      <td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="4">Tổng số điểm</td>
      <td colspan="3">...</td>
      <td colspan="3">...</td>
      <td colspan="3">...</td>
      <td colspan="3">...</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="4">Tỉ lệ %</td>
      <td colspan="3">...%</td>
      <td colspan="3">...%</td>
      <td colspan="3">...%</td>
      <td colspan="3">...%</td>
    </tr>
  </tbody>
</table>

### **PHẦN 3: ĐỀ KIỂM TRA**
Viết toàn bộ nội dung Đề thi mới được nhân bản.

### **PHẦN 4: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM**
1. Bảng đáp án Phần I và Phần II (Bảng Markdown).
2. Bảng Hướng dẫn chấm Phần Tự luận / Trả lời ngắn: BẮT BUỘC DÙNG BẢNG MARKDOWN DƯỚI ĐÂY. KHÔNG dùng 3 dấu gạch ngược (\`\`\`) bên trong bảng. Dùng thẻ <br> để xuống dòng.
| Câu | Nội dung đáp án / Code / Công thức | Điểm |
|:---:|---|:---:|
| 1 | Lời giải dòng 1 <br> Lời giải dòng 2 | ... |
        `;

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();

        const targetStart = "### **PHẦN 1";
        const startIndex = textResult.indexOf(targetStart);
        if (startIndex !== -1) {
            textResult = textResult.substring(startIndex);
        }

        textResult = textResult.replace(/```html\n?/g, '');
        textResult = textResult.replace(/```markdown\n?/g, '');
        textResult = textResult.replace(/```\s*$/g, '');

        let splitParts = textResult.split("### **PHẦN 4:");
        let part123 = splitParts[0];
        let part4 = splitParts.length > 1 ? "\n### **PHẦN 4:" + splitParts[1] : "";

        part4 = part4.replace(/```[a-zA-Z]*\n?/g, '<br>'); 
        part4 = part4.replace(/```/g, '<br>');

        part123 = part123.replace(/a\),\s*b\),\s*c\),\s*d\)/g, '@@ABCD_LOWER@@');

        part123 = part123.replace(/([^\n])\s+(\*?[A-D]\.)/g, '$1\n\n$2');
        part123 = part123.replace(/([^\n])\s+(\*?[a-d]\))/g, '$1\n\n$2');
        part123 = part123.replace(/(\n)(\*?[A-D]\.)/g, '\n\n$2');
        part123 = part123.replace(/(\n)(\*?[a-d]\))/g, '\n\n$2');

        part123 = part123.replace(/@@ABCD_LOWER@@/g, 'a), b), c), d)');

        textResult = part123 + part4;

        textResult = textResult.replace(/Key:\s*\[([^\]]+)\]/gi, 'Key: $1');
        textResult = textResult.replace(/\n\n\*([A-D]\.)/g, '\n\n\\*$1');
        textResult = textResult.replace(/\n\n\*([a-d]\))/g, '\n\n\\*$1');
        textResult = textResult.replace(/^\*([A-D]\.)/gm, '\\*$1');
        textResult = textResult.replace(/^\*([a-d]\))/gm, '\\*$1');

        textResult = textResult.replace(/\\\((.*?)\\\)/g, '$$$1$$');
        textResult = textResult.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$');
        textResult = textResult.replace(/\\begin\{align\}/g, '\\begin{aligned}');
        textResult = textResult.replace(/\\end\{align\}/g, '\\end{aligned}');
        textResult = textResult.replace(/\$([^$\n]+?)\$/g, (match, p1) => '$' + p1.trim() + '$');
        textResult = textResult.replace(/\$([^$\n]+?)\$([\p{L}\p{N}])/gu, '$$$1$$ $2');
        textResult = textResult.replace(/([\p{L}\p{N}])\$([^$\n]+?)\$/gu, '$1 $$$2$$');
        textResult = textResult.replace(/['"`](\$[^$\n]+?\$)['"`]/g, '$1');

        setResultMarkdown(textResult);

    } catch (error) {
        console.error(error);
        alert("Lỗi nhân bản đề: " + error.message);
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
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='[http://www.w3.org/TR/REC-html40](http://www.w3.org/TR/REC-html40)'>
          <head>
              <meta charset='utf-8'>
              <title>De Kiem Tra Landscape</title>
              <style>
                  @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 28.3pt 28.3pt 28.3pt 42.5pt; }
                  div.Section1 { page: Section1; }
                  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1; text-align: justify; }
                  h2 { font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-top: 16pt; margin-bottom: 8pt; }
                  h3 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 14pt; margin-bottom: 6pt; color: #b91c1c; }
                  h4 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
                  p, li { font-size: 12pt; line-height: 1.2; margin-top: 3pt; margin-bottom: 3pt; }
                  ul { padding-left: 20pt; margin-top: 3pt; margin-bottom: 3pt; }
                  table { width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 10pt; font-size: 11pt; }
                  table, th, td { border: 1px solid black; }
                  th { font-weight: bold; background-color: #f8fafc; text-align: center; padding: 4pt; vertical-align: middle; }
                  td { padding: 4pt; text-align: center; vertical-align: middle; } 
                  sup { vertical-align: super; font-size: smaller; }
                  sub { vertical-align: sub; font-size: smaller; }
                  pre { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 8pt; border-radius: 4pt; font-family: 'Courier New', Courier, monospace; font-size: 11pt; white-space: pre-wrap; margin: 6pt 0; }
                  code { font-family: 'Courier New', Courier, monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 3px; }
              </style>
          </head>
          <body>
          <div class="Section1">
      `;
      const footer = "</div></body></html>";
      
      const htmlContent = exportNode.innerHTML;
      const finalHtmlContent = htmlContent.replace(/\\\*/g, '*'); 
      const sourceHTML = header + finalHtmlContent + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `Nhan_Ban_De_${subject}_Lop${grade}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
  };

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
          <p className="text-slate-400 mb-10 font-bold tracking-widest text-xs md:text-sm relative z-10 px-4 max-w-lg">Công cụ Nhân Bản Đề AI là vũ khí tuyệt mật. Bạn cần đăng nhập bằng tài khoản <span className="text-red-400 font-black">GIÁO VIÊN</span> để sử dụng.</p>
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
                     AI NHÂN BẢN ĐỀ
                 </h1>
                 <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest">Hệ thống phân tích & Sinh đề tự động</p>
             </div>
         </div>
         {resultMarkdown && (
             <button onClick={exportToWord} className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:shadow-[0_0_30px_rgba(239,68,68,0.9)] hover:scale-105 transition-all border border-red-400/50">
                 <Download size={18}/> TẢI BẢN WORD
             </button>
         )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10">
          
          {/* LEFT SIDEBAR - CONTROL PANEL */}
          <div className="w-full lg:w-[420px] bg-black/60 backdrop-blur-md border-r border-orange-500/30 shadow-[5px_0_30px_rgba(249,115,22,0.1)] overflow-y-auto p-5 custom-scrollbar shrink-0">
              
              <div className="space-y-6">
                  
                  {/* NEON UPLOAD BOX */}
                  <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                      <div className="relative bg-gray-950 p-6 rounded-xl border border-orange-500/50 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-full flex items-center justify-center mb-4 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.4)] group-hover:scale-110 transition-transform">
                              <Copy size={28} className="text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]"/>
                          </div>
                          <h3 className="text-sm font-black text-white uppercase mb-1 tracking-wider text-shadow-sm">Tải đề gốc lên đây</h3>
                          <p className="text-[11px] text-orange-200/60 mb-5">Hỗ trợ định dạng: Word (.docx), PDF (.pdf), Text (.txt)</p>
                          
                          <input 
                              type="file" 
                              id="file-clone-upload" 
                              accept=".txt, .docx, .pdf" 
                              onChange={handleFileUpload} 
                              className="hidden" 
                          />
                          <label htmlFor="file-clone-upload" className="cursor-pointer w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600/80 to-red-600/80 hover:from-orange-500 hover:to-red-500 border border-orange-400/50 text-white px-4 py-3 rounded-lg font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(249,115,22,0.5)] transition-all">
                              {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                              {isExtracting ? 'ĐANG DỊCH MÃ TỆP...' : 'CHỌN TỆP ĐỀ GỐC'}
                          </label>

                          {uploadedFileName && (
                              <div className="w-full mt-4 flex justify-between items-center bg-gray-900 border border-orange-500/50 p-3 rounded-lg text-xs shadow-[inset_0_0_10px_rgba(249,115,22,0.2)]">
                                  <div className="flex items-center gap-2 truncate text-orange-300">
                                      <FileText size={16} className="text-orange-500 shrink-0 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                                      <span className="truncate font-bold tracking-wide">{uploadedFileName}</span>
                                  </div>
                                  <button onClick={clearUploadedFile} className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-md shrink-0 transition-colors">
                                      <X size={16} />
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* FORM INPUTS */}
                  <div className="space-y-4 bg-gray-950/50 p-4 rounded-xl border border-white/5">
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
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Tiêu đề Đề mới</label>
                          <input value={testTitle} onChange={e=>setTestTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm transition-all shadow-inner"/>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Yêu cầu thêm (Tùy chọn)</label>
                          <textarea 
                              value={additionalNote} 
                              onChange={e=>setAdditionalNote(e.target.value)} 
                              rows={2} 
                              className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 text-xs transition-all shadow-inner custom-scrollbar" 
                              placeholder="VD: Tăng độ khó tự luận, bổ sung thực tế..."
                          />
                      </div>
                  </div>

                  {/* ACTION BUTTON MANG SỨC MẠNH CỦA LỬA */}
                  <button onClick={handleCloneTest} disabled={loading || !uploadedText} className={`relative w-full py-4 rounded-xl font-black uppercase tracking-widest text-white overflow-hidden group transition-all mt-6 ${(!uploadedText || loading) ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' : 'border border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.6)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] active:scale-95'}`}>
                      {uploadedText && !loading && (
                          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 group-hover:scale-110 transition-transform duration-500"></div>
                      )}
                      <div className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? <Flame className="animate-bounce text-yellow-300"/> : <Sparkles size={20}/>} 
                          {loading ? 'ĐANG NUNG CHẢY & ĐÚC ĐỀ...' : 'BẮT ĐẦU NHÂN BẢN ĐỀ'}
                      </div>
                  </button>
              </div>
          </div>

          {/* RIGHT PANEL - PREVIEW AREA */}
          <div className="flex-1 bg-gray-900/80 overflow-y-auto relative p-4 md:p-8 custom-scrollbar relative shadow-[inset_10px_0_30px_rgba(0,0,0,0.5)]">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-orange-500">
                      <div className="relative mb-8">
                          <div className="absolute inset-0 bg-gradient-to-t from-red-600 to-yellow-400 blur-[60px] opacity-70 animate-pulse rounded-full w-32 h-32 -ml-8 -mt-8"></div>
                          <Flame size={90} className="text-yellow-400 relative z-10 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"/>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-2" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>HỆ THỐNG ĐANG PHÂN TÍCH</h3>
                      <p className="text-sm font-bold tracking-widest text-orange-200/60 animate-pulse">Quá trình ép xung AI có thể mất 30-60 giây...</p>
                  </div>
              ) : resultMarkdown ? (
                  <div className="bg-white p-8 md:p-14 rounded-sm shadow-[0_0_40px_rgba(239,68,68,0.3)] border border-red-500/20 max-w-[1200px] mx-auto min-h-full text-black" id="markdown-export-area">
                      <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt', marginBottom: '16pt' }}>
                          <h2 style={{ fontSize: '16pt', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', marginBottom: '4pt', color: '#000' }}>
                              {testTitle}
                          </h2>
                          <h5 style={{ fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', marginTop: 0, marginBottom: '24pt', color: '#000' }}>
                              Môn: {subject} {grade}
                          </h5>
                      </div>
                      <div style={{ fontFamily: "'Times New Roman', serif" }}>
                          <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeRaw, rehypeKatex]} 
                              components={{
                                  h3: ({node, ...props}) => <h3 style={{fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '20pt', marginBottom: '8pt', color: '#b91c1c', borderBottom: '2px solid #b91c1c', paddingBottom: '4px'}} {...props}/>,
                                  h4: ({node, ...props}) => <h4 style={{fontSize: '12pt', fontWeight: 'bold', marginTop: '12pt', marginBottom: '6pt'}} {...props}/>,
                                  p: ({node, ...props}) => <p style={{fontSize: '12pt', lineHeight: '1.2', margin: '4pt 0', textAlign: 'justify'}} {...props}/>,
                                  ul: ({node, ...props}) => <ul style={{fontSize: '12pt', listStyleType: 'disc', paddingLeft: '20pt', margin: '4pt 0'}} {...props}/>,
                                  ol: ({node, ...props}) => <ol style={{fontSize: '12pt', listStyleType: 'decimal', paddingLeft: '20pt', margin: '4pt 0'}} {...props}/>,
                                  li: ({node, ...props}) => <li style={{marginBottom: '3pt', lineHeight: '1.2'}} {...props}/>,
                                  strong: ({node, ...props}) => <strong style={{fontWeight: 'bold'}} {...props}/>,
                                  em: ({node, ...props}) => <em style={{fontStyle: 'italic'}} {...props}/>,
                                  table: ({node, ...props}) => <div style={{overflowX: 'auto'}}><table style={{width: '100%', borderCollapse: 'collapse', marginTop: '10pt', marginBottom: '10pt', fontSize: '11pt'}} {...props}/></div>,
                                  th: ({node, ...props}) => <th style={{border: '1px solid black', padding: '6pt', backgroundColor: '#f8fafc', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', color: '#000'}} {...props}/>,
                                  td: ({node, ...props}) => <td style={{border: '1px solid black', padding: '6pt', verticalAlign: 'top', color: '#000'}} {...props}/>,
                                  pre: ({node, ...props}) => <pre style={{backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10pt', borderRadius: '4pt', overflowX: 'auto', fontFamily: "'Courier New', Courier, monospace", fontSize: '11pt', margin: '8pt 0'}} {...props}/>,
                                  code: ({node, inline, ...props}) => inline ? <code style={{backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', fontFamily: "'Courier New', Courier, monospace", color: '#e11d48'}} {...props}/> : <code style={{fontFamily: "'Courier New', Courier, monospace", color: '#000'}} {...props}/>,
                              }}
                          >
                              {resultMarkdown}
                          </ReactMarkdown>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-60">
                      <div className="relative mb-6">
                          <Copy size={120} className="text-gray-800 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]"/>
                      </div>
                      <p className="text-2xl font-black uppercase tracking-[0.2em] text-center text-gray-600 drop-shadow-md">TẢI ĐỀ GỐC LÊN<br/><span className="text-sm font-bold tracking-widest text-gray-500">ĐỂ KHỞI ĐỘNG LÒ PHẢN ỨNG</span></p>
                  </div>
              )}
          </div>

      </div>
    </div>
  );
}