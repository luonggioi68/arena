import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import rehypeRaw from 'rehype-raw'; 
import remarkMath from 'remark-math'; 
import rehypeKatex from 'rehype-katex'; 
import 'katex/dist/katex.min.css'; 
import * as mammoth from 'mammoth'; 
import { ArrowLeft, Sparkles, Loader2, LayoutTemplate, Database, Target, Flame, FileText, AlertCircle, Download, Upload, X, Eraser, Zap, Server } from 'lucide-react';

const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];

export default function FastQuestionGenerator() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [subject, setSubject] = useState('Tin học');
  const [grade, setGrade] = useState('11');
  const [testTitle, setTestTitle] = useState('ĐỀ KIỂM TRA MÔN TIN HỌC');
  
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSourceLink, setSelectedSourceLink] = useState('');
  const [testScope, setTestScope] = useState(''); 

  const [uploadedText, setUploadedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isFetchingDoc, setIsFetchingDoc] = useState(false);
  const [resultMarkdown, setResultMarkdown] = useState('');

  const [matrix, setMatrix] = useState({
      mcq: { b: 1, h: 2, vd: 2 }, 
      tf: { b: 1, h: 2, vd: 1 },   
      sa: { b: 1, h: 0, vd: 0 },  
      essay: { b: 0, h: 0, vd: 1 } 
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
      const fetchSources = async () => {
          try {
              const q = query(
                  collection(firestore, "exam_sources"),
                  where("grade", "==", grade),
                  where("subject", "==", subject)
              );
              const snap = await getDocs(q);
              setAvailableSources(snap.docs.map(d => ({id: d.id, ...d.data()})));
              setSelectedSourceLink(''); 
          } catch (e) { console.error("Lỗi tải nguồn:", e); }
      };
      fetchSources();
  }, [grade, subject]);

  const handleMatrixChange = (type, level, value) => {
      let val = parseFloat(value);
      if (isNaN(val) || val < 0) val = 0;
      setMatrix(prev => ({ ...prev, [type]: { ...prev[type], [level]: val } }));
  };

  const handleClearMatrix = () => {
      setMatrix({
          mcq: { b: 0, h: 0, vd: 0 },
          tf: { b: 0, h: 0, vd: 0 },
          sa: { b: 0, h: 0, vd: 0 },
          essay: { b: 0, h: 0, vd: 0 }
      });
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileType = file.name.split('.').pop().toLowerCase();
      if (!['txt', 'docx', 'pdf'].includes(fileType)) {
          return alert("Hệ thống hiện tại chỉ hỗ trợ tải lên file .txt, .docx và .pdf!");
      }

      setUploadedFileName(file.name);
      setIsExtracting(true);

      try {
          if (fileType === 'txt') {
              const reader = new FileReader();
              reader.onload = (event) => {
                  setUploadedText(event.target.result);
                  setIsExtracting(false);
              };
              reader.readAsText(file);
          } 
          else if (fileType === 'docx') {
              const reader = new FileReader();
              reader.onload = async (event) => {
                  const arrayBuffer = event.target.result;
                  const result = await mammoth.extractRawText({ arrayBuffer });
                  setUploadedText(result.value);
                  setIsExtracting(false);
              };
              reader.readAsArrayBuffer(file);
          }
          else if (fileType === 'pdf') {
              if (!window.pdfjsLib) {
                  await new Promise((resolve, reject) => {
                      const script = document.createElement('script');
                      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                      script.onload = () => {
                          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                          resolve();
                      };
                      script.onerror = () => reject(new Error("Lỗi tải thư viện đọc PDF. Vui lòng kiểm tra kết nối mạng!"));
                      document.head.appendChild(script);
                  });
              }
              
              const arrayBuffer = await file.arrayBuffer();
              const typedArray = new Uint8Array(arrayBuffer);
              const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
              let fullText = '';
              
              for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  const pageText = textContent.items.map(item => item.str).join(' ');
                  fullText += pageText + '\n\n';
              }
              setUploadedText(fullText);
              setIsExtracting(false);
          }
      } catch (error) {
          console.error("Lỗi đọc file:", error);
          alert("Có lỗi xảy ra khi đọc file! " + error.message);
          setIsExtracting(false);
          setUploadedFileName('');
      }
      e.target.value = null; 
  };

  const clearUploadedFile = () => {
      setUploadedText('');
      setUploadedFileName('');
  };

  const getTotalQ_Normal = (type) => matrix[type].b + matrix[type].h + matrix[type].vd;
  const totalTF_Y = matrix.tf.b + matrix.tf.h + matrix.tf.vd; 
  const totalTF_Q = totalTF_Y / 4; 

  const handleGenerateQuestions = async () => {
    const countMCQ = getTotalQ_Normal('mcq');
    const countTF = totalTF_Q; 
    const countSA = getTotalQ_Normal('sa');
    const countEssay = getTotalQ_Normal('essay');

    if (countMCQ === 0 && countTF === 0 && countSA === 0 && countEssay === 0) {
        return alert("Vui lòng thiết lập số lượng ít nhất 1 câu hỏi vào bảng cấu hình!");
    }
    if (!testTitle.trim()) return alert("Vui lòng nhập Tiêu đề bài kiểm tra!");
    if (!testScope.trim() && !selectedSourceLink && !uploadedText) {
        return alert("Vui lòng Chọn Nguồn Thư Viện, Tải file lên hoặc Nhập tay Phạm vi!");
    }
    if (totalTF_Y > 0 && totalTF_Y % 4 !== 0) {
        return alert(`CẢNH BÁO: Phần Đúng/Sai đang có tổng cộng ${totalTF_Y} ý. Vui lòng điều chỉnh lại cho chia hết cho 4!`);
    }

    setLoading(true);
    setResultMarkdown('');

    try {
        let extractedDocText = "";
        if (selectedSourceLink) {
            setIsFetchingDoc(true);
            const res = await fetch('/api/fetch-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: selectedSourceLink })
            });
            
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Lỗi Hệ Thống: Không tìm thấy API fetch-doc.");
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Lỗi khi đọc tài liệu Thư viện Admin.");
            extractedDocText = data.text;
            setIsFetchingDoc(false);
        }

        const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
        if (!userConfigDoc.exists() || !userConfigDoc.data().geminiKey) {
            throw new Error("Chưa cấu hình Gemini API Key trong menu Cấu Hình!");
        }
        
        const config = userConfigDoc.data();
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        const selectedModel = config.geminiModel || "gemini-1.5-pro";
        const model = genAI.getGenerativeModel({ model: selectedModel });

        let finalContextText = "";
        if (extractedDocText) finalContextText += `[NỘI DUNG TỪ THƯ VIỆN TRƯỜNG]:\n${extractedDocText}\n\n`;
        if (uploadedText) finalContextText += `[NỘI DUNG TỪ FILE GIÁO VIÊN TẢI LÊN]:\n${uploadedText}\n\n`;

        const sourcePromptContext = finalContextText 
            ? `\n**NGỮ LIỆU ĐẦU VÀO (GIỚI HẠN TUYỆT ĐỐI):**\n"""\n${finalContextText}\n"""\n`
            : "";

        // CHUẨN BỊ LOGIC TẠO ĐỀ ĐỘNG (BỎ QUA PHẦN KHÔNG CÓ CÂU HỎI)
        let requirementList = [];
        let examStructure = [];
        let answerStructure = [];
        let currentPart = 1;

        const toRoman = (num) => {
            const roman = ['I', 'II', 'III', 'IV'];
            return roman[num - 1] || 'I';
        };

        if (countMCQ > 0) {
            requirementList.push(`${currentPart}. Phần ${toRoman(currentPart)} (Nhiều lựa chọn): Tổng ${countMCQ} câu (Biết: ${matrix.mcq.b}, Hiểu: ${matrix.mcq.h}, Vận dụng: ${matrix.mcq.vd}).`);
            examStructure.push(`**PHẦN ${toRoman(currentPart)}. Câu trắc nghiệm nhiều phương án lựa chọn.** Thí sinh trả lời từ câu 1 đến câu ${countMCQ}.\n(Nội dung các câu hỏi...)`);
            answerStructure.push(`${currentPart}. Bảng đáp án Phần ${toRoman(currentPart)} (Dùng bảng Markdown).`);
            currentPart++;
        }

        if (countTF > 0) {
            requirementList.push(`${currentPart}. Phần ${toRoman(currentPart)} (Đúng/Sai): Tổng ${countTF} câu. (Mỗi câu bắt buộc 4 ý a,b,c,d). Phân bổ: Biết ${matrix.tf.b} ý, Hiểu ${matrix.tf.h} ý, Vận dụng ${matrix.tf.vd} ý. Lời dẫn là tình huống thực tế 2-3 dòng.`);
            examStructure.push(`**PHẦN ${toRoman(currentPart)}. Câu trắc nghiệm đúng sai.** Thí sinh trả lời từ câu 1 đến câu ${countTF}.\n**Câu 1:** Lời dẫn tình huống... \na) Nội dung ý...\nb) Nội dung ý...`);
            answerStructure.push(`${currentPart}. Bảng đáp án Phần ${toRoman(currentPart)} (Dùng bảng Markdown).`);
            currentPart++;
        }

        if (countSA > 0) {
            requirementList.push(`${currentPart}. Phần ${toRoman(currentPart)} (Trả lời ngắn): Tổng ${countSA} câu (Biết: ${matrix.sa.b}, Hiểu: ${matrix.sa.h}, Vận dụng: ${matrix.sa.vd}).`);
            examStructure.push(`**PHẦN ${toRoman(currentPart)}. Câu trắc nghiệm trả lời ngắn.** Thí sinh trả lời từ câu 1 đến câu ${countSA}.\n(Ghi "Key: đáp án" dưới mỗi câu)`);
            answerStructure.push(`${currentPart}. Hướng dẫn chấm Phần ${toRoman(currentPart)} (Trả lời ngắn): Kẻ bảng gồm CÂU và ĐÁP ÁN (Key).`);
            currentPart++;
        }

        if (countEssay > 0) {
            requirementList.push(`${currentPart}. Phần ${toRoman(currentPart)} (Tự luận): Tổng ${countEssay} câu (Biết: ${matrix.essay.b}, Hiểu: ${matrix.essay.h}, Vận dụng: ${matrix.essay.vd}).`);
            examStructure.push(`**PHẦN ${toRoman(currentPart)}. Tự luận.**\n(Nội dung câu hỏi tự luận - Reset bắt đầu từ Câu 1)`);
            answerStructure.push(`${currentPart}. Bảng Hướng dẫn chấm Phần ${toRoman(currentPart)} (Tự luận): BẮT BUỘC DÙNG BẢNG MARKDOWN NHƯ SAU:\n| Câu | Nội dung đáp án / Code / Công thức | Điểm |\n|:---:|---|:---:|\n| 1 | Lời giải dòng 1 <br> Lời giải dòng 2 | 1.0 |\n(TUYỆT ĐỐI KHÔNG DÙNG \`\`\` TRONG BẢNG NÀY, dùng <br> để xuống dòng)`);
            currentPart++;
        }

        const requirementText = requirementList.join('\n');
        const examStructureText = examStructure.join('\n\n');
        const answerStructureText = answerStructure.join('\n');

        const prompt = `
Bạn là một Chuyên gia Khảo thí giáo dục hàng đầu. Hãy tạo một Bộ Đề Kiểm Tra chuẩn form cấu trúc 2025 của Bộ GD&ĐT dựa trên các yêu cầu sau:

🛑 LỆNH TỐI CAO (SỐNG CÒN):
1. BÁM SÁT 100% NGUỒN: TUYỆT ĐỐI KHÔNG ĐƯỢC sử dụng kiến thức, khái niệm, nhân vật hay số liệu nằm ngoài "NGỮ LIỆU ĐẦU VÀO". Mọi câu hỏi phải được trích xuất trực tiếp từ văn bản. Nếu nguồn ngắn, hãy khai thác sâu các chi tiết khác nhau của văn bản, lật ngược vấn đề, cấm bịa đặt kiến thức bên ngoài.
2. CHUẨN CÔNG THỨC TOÁN/LÍ/HÓA: Tất cả công thức, phương trình, số học, ký hiệu BẮT BUỘC dùng chuẩn LaTeX.
   - Công thức cùng dòng (inline) bọc trong 1 dấu $: VD: $x^2 + 2x + 1 = 0$
   - Công thức đứng riêng 1 dòng (block) bọc trong 2 dấu $$: VD: $$\\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$
3. CHỈ XUẤT ĐỀ THI VÀ ĐÁP ÁN THEO ĐÚNG CÁC PHẦN ĐƯỢC YÊU CẦU. KHÔNG CẦN MA TRẬN ĐẶC TẢ.
4. KHÔNG TỰ IN TIÊU ĐỀ, hãy bắt đầu ngay vào "PHẦN I".
5. TUYỆT ĐỐI KHÔNG ĐẶT CÂU HỎI KIỂU: THEO SÁCH GIÁO KHOA, THEO NỘI DUNG VĂN BẢN, THEO KIẾN THỨC ĐÃ HỌC,... HÃY DỰA HOÀN TOÀN VÀO NGỮ LIỆU ĐẦU VÀO ĐỂ TẠO CÂU HỎI.
6. TRẢ LỜI TRÁNH: TẤT CẢ ĐỀU ĐÚNG, A, B, C, D ĐỀU SAI,... KHÔNG CHẤP NHẬN NHỮNG CÂU HỎI KIỂU NÀY.
7. Công thức toán/lí/hoá và các môn khác đơn giản(như số,biểu thức, cộng trừ nhân chia,...) không cần LaTeX ví dụ: 20, x, 2x=2,2+4,... nhưng nếu có công thức phức tạp hoặc muốn đảm bảo định dạng chuẩn thì nên dùng LaTeX. Ví dụ: $E=mc^2$ hoặc $$\\int_a^b f(x) dx = F(b) - F(a)$$.

**THÔNG TIN ĐỀ THI:**
- Môn: ${subject} - Lớp: ${grade}
${sourcePromptContext}
- PHẠM VI KIẾN THỨC BỔ SUNG (Giáo viên nhập): """${testScope}"""

**CẤU TRÚC VÀ PHÂN MỨC ĐỘ NHẬN THỨC:**
- [Biết]: Nhận diện, nhớ lại định nghĩa, công thức, chi tiết có sẵn rành mạch trong văn bản.
- [Hiểu]: Giải thích, phân loại, tóm tắt, so sánh các thông tin có trong văn bản.
- [Vận dụng]: Áp dụng công thức, dữ kiện trong văn bản để tính toán, xử lý tình huống cụ thể.

**SỐ LƯỢNG CÂU HỎI YÊU CẦU (CHỈ TẠO CÁC PHẦN ĐƯỢC LIỆT KÊ BÊN DƯỚI, TUYỆT ĐỐI KHÔNG TẠO PHẦN NÀO KHÁC):**
${requirementText}

**QUY TẮC ĐỊNH DẠNG ĐÁP ÁN (BẮT BUỘC):**
- Trắc nghiệm: Thêm một dấu sao (*) dính liền chữ cái đúng. VD: *A. , *B. , *C. , *D. (Cấm viết: * A. hay **A.**)
- Đúng/Sai: Thêm dấu sao (*) dính liền trước chữ cái của ý ĐÚNG. VD: *a) , *b) (Cấm viết: * a) hay **a)**)
- Mỗi phần phải đánh số lại từ Câu 1.

**BẠN PHẢI TRẢ VỀ ĐÚNG 2 MỤC THEO THỨ TỰ SAU:**

### **PHẦN 1: ĐỀ KIỂM TRA**
${examStructureText}

### **PHẦN 2: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM**
${answerStructureText}
        `;

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();

        textResult = textResult.replace(/```html\n?/g, '');
        textResult = textResult.replace(/```markdown\n?/g, '');
        textResult = textResult.replace(/```\s*$/g, '');

        let splitParts = textResult.split("### **PHẦN 2: ĐÁP ÁN");
        let part1 = splitParts[0];
        let part2 = splitParts.length > 1 ? "\n### **PHẦN 2: ĐÁP ÁN" + splitParts[1] : "";

        part2 = part2.replace(/```[a-zA-Z]*\n?/g, '<br>'); 
        part2 = part2.replace(/```/g, '<br>');

        part1 = part1.replace(/a\),\s*b\),\s*c\),\s*d\)/g, '@@ABCD_LOWER@@');
        part1 = part1.replace(/([^\n])\s+(\*?[A-D]\.)/g, '$1\n\n$2');
        part1 = part1.replace(/([^\n])\s+(\*?[a-d]\))/g, '$1\n\n$2');
        part1 = part1.replace(/(\n)(\*?[A-D]\.)/g, '\n\n$2');
        part1 = part1.replace(/(\n)(\*?[a-d]\))/g, '\n\n$2');
        part1 = part1.replace(/@@ABCD_LOWER@@/g, 'a), b), c), d)');

        part1 = part1.replace(/\*\*\s*([A-D]\.)\s*\*\*/g, '\\*$1');
        part1 = part1.replace(/\*\*\s*([a-d]\))\s*\*\*/g, '\\*$1');
        part1 = part1.replace(/\*\s+([A-D]\.)/g, '\\*$1');
        part1 = part1.replace(/\*\s+([a-d]\))/g, '\\*$1');
        part1 = part1.replace(/(^|\n)(\*+)([A-D]\.)/g, '$1\\*$3');
        part1 = part1.replace(/(^|\n)(\*+)([a-d]\))/g, '$1\\*$3');
        part1 = part1.replace(/\\\\/g, '\\');

        textResult = part1 + part2;
        textResult = textResult.replace(/Key:\s*\[([^\]]+)\]/gi, 'Key: $1');

        textResult = textResult.replace(/\\\((.*?)\\\)/g, '$$$1$$');
        textResult = textResult.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$');
        textResult = textResult.replace(/\\begin\{align\}/g, '\\begin{aligned}');
        textResult = textResult.replace(/\\end\{align\}/g, '\\end{aligned}');
        textResult = textResult.replace(/\$([^$\n]+?)\$/g, (match, p1) => '$' + p1.trim() + '$');
        
        setResultMarkdown(textResult);

    } catch (error) {
        alert(error.message);
    } finally {
        setLoading(false);
        setIsFetchingDoc(false);
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
              <title>${testTitle}</title>
              <style>
                  @page Section1 {
                      size: 595.3pt 841.9pt; /* A4 Portrait */
                      margin: 42.5pt 42.5pt 42.5pt 56.7pt; /* Top: 1.5cm, Right: 1.5cm, Bottom: 1.5cm, Left: 2cm */
                      mso-header-margin: 35.4pt;
                      mso-footer-margin: 35.4pt;
                      mso-paper-source: 0;
                  }
                  div.Section1 { page: Section1; }
                  
                  body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.15; text-align: justify; color: #000; }
                  h3 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-top: 18pt; margin-bottom: 6pt; }
                  p, li { margin-top: 4pt; margin-bottom: 4pt; }
                  ul, ol { padding-left: 24pt; }
                  table { width: 100%; border-collapse: collapse; margin-top: 12pt; margin-bottom: 12pt; font-size: 12pt; }
                  table, th, td { border: 1px solid black; }
                  th { font-weight: bold; background-color: #f2f2f2; text-align: center; padding: 6pt; vertical-align: middle; }
                  td { padding: 6pt; vertical-align: middle; } 
              </style>
          </head>
          <body><div class="Section1">
      `;
      const footer = "</div></body></html>";
      
      let htmlContent = exportNode.innerHTML;
      htmlContent = htmlContent.replace(/\\\*/g, '*'); 
      const sourceHTML = header + htmlContent + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `De_Kiem_Tra_${subject}_Lop${grade}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
  };

  if (authLoading) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-bold shadow-[0_0_20px_rgba(249,115,22,0.5)]">
              <Flame className="animate-bounce mr-2" size={30} /> ĐANG KHỞI ĐỘNG HỆ THỐNG...
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050505] font-sans flex flex-col h-screen overflow-hidden text-gray-200 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-600/20 blur-[150px] rounded-full pointer-events-none"></div>

      <header className="h-[70px] bg-black/80 backdrop-blur-md border-b border-red-500/40 shadow-[0_4px_30px_rgba(239,68,68,0.3)] px-4 md:px-6 flex justify-between items-center shrink-0 z-10 relative">
         <div className="flex items-center gap-3 md:gap-4">
             <button onClick={() => router.push('/')} className="p-2 bg-gray-900 border border-red-500/30 hover:bg-red-950/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-xl transition-all"><ArrowLeft size={20} className="text-orange-400"/></button>
             <div>
                 <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600" style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
                     AI TẠO CÂU HỎI NHANH
                 </h1>
                 <p className="text-[9px] md:text-[10px] font-bold text-orange-400/80 uppercase tracking-widest hidden sm:block">Trắc nghiệm - đúng sai - trả lời ngắn- tự luận</p>
             </div>
         </div>
         {resultMarkdown && (
             <button onClick={exportToWord} className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-black text-xs md:text-sm shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:shadow-[0_0_30px_rgba(239,68,68,0.9)] hover:scale-105 transition-all border border-red-400/50">
                 <Download size={16}/> <span className="hidden sm:inline">TẢI BẢN WORD</span><span className="sm:hidden">TẢI</span>
             </button>
         )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10">
          
          <div className="w-full lg:w-[460px] bg-black/60 backdrop-blur-md border-r border-orange-500/30 shadow-[5px_0_30px_rgba(249,115,22,0.1)] overflow-y-auto p-4 custom-scrollbar shrink-0">
              <div className="space-y-4">
                  
                  <div className="bg-gray-950/50 p-4 rounded-xl border border-white/5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Khối lớp</label>
                              <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg text-sm text-orange-100 font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all">{GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}</select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Môn học</label>
                              <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg text-sm text-orange-100 font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Tiêu đề Bài kiểm tra</label>
                          <input value={testTitle} onChange={e=>setTestTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg text-sm text-orange-100 font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all" placeholder="VD: ĐỀ KIỂM TRA MÔN TIN HỌC"/>
                      </div>
                  </div>

                  <div className="bg-gray-950/80 p-4 rounded-xl border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)] transition-all hover:border-orange-500/60">
                      <label className="block text-[10px] font-black text-orange-400 uppercase tracking-wider flex items-center gap-2 mb-3"><Server size={14}/> 1. Nguồn Thư Viện Admin</label>
                      {availableSources.length > 0 ? (
                          <select value={selectedSourceLink} onChange={e => setSelectedSourceLink(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg text-xs text-orange-200 mb-1 font-bold outline-none focus:border-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                              <option value="">-- Bỏ qua hoặc chọn nguồn gốc --</option>
                              {availableSources.map(src => (
                                  <option key={src.id} value={src.docLink}>{src.title}</option>
                              ))}
                          </select>
                      ) : (
                          <div className="text-[10px] text-gray-500 italic mb-1">Chưa có dữ liệu Thư viện cho Môn/Lớp này.</div>
                      )}
                  </div>

                  <div className="relative group bg-gray-950/80 p-4 rounded-xl border border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)] transition-all hover:border-blue-500/60">
                      <div className="flex justify-between items-end mb-3">
                          <label className="block text-[10px] font-black text-blue-400 uppercase tracking-wider drop-shadow-[0_0_5px_rgba(59,130,246,0.8)] flex items-center gap-2"><Upload size={14}/> 2. Tải Tệp Lên / Nhập Tay</label>
                          <input 
                              type="file" id="file-upload" accept=".txt, .docx, .pdf" onChange={handleFileUpload} className="hidden" 
                          />
                          <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-1 bg-gradient-to-r from-blue-600/80 to-cyan-600/80 hover:from-blue-500 hover:to-cyan-500 text-white px-3 py-1.5 rounded border border-cyan-400/50 text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all">
                              {isExtracting ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                              {isExtracting ? 'ĐANG ĐỌC...' : 'TẢI FILE MÁY TÍNH'}
                          </label>
                      </div>

                      {uploadedFileName && (
                          <div className="flex justify-between items-center bg-gray-900 border border-cyan-500/50 p-2 mb-3 rounded-lg text-xs shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]">
                              <div className="flex items-center gap-2 truncate text-cyan-300">
                                  <FileText size={14} className="text-cyan-500 shrink-0 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                                  <span className="truncate">Đã tải: <strong>{uploadedFileName}</strong></span>
                              </div>
                              <button onClick={clearUploadedFile} className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-md shrink-0 transition-colors"><X size={14} /></button>
                          </div>
                      )}

                      <textarea 
                          value={testScope} onChange={e=>setTestScope(e.target.value)} rows={3} 
                          className="w-full bg-gray-900 border border-gray-700 hover:border-blue-500/50 p-2.5 rounded-lg text-xs text-blue-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.3)] outline-none custom-scrollbar transition-all" 
                          placeholder="Nhập giới hạn (VD: Chỉ lấy phần Quang học)..."
                      />
                  </div>

                  <div className="bg-gray-950 rounded-xl border border-orange-500/30 overflow-hidden shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                      <div className="bg-gray-900 border-b border-orange-500/30 p-3 flex justify-between items-center">
                          <label className="block text-xs font-black text-orange-400 uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]"><LayoutTemplate size={16}/> Cấu hình Câu hỏi</label>
                          <div className="flex items-center gap-2 md:gap-3">
                              {totalTF_Y > 0 && totalTF_Y % 4 !== 0 && <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]"><AlertCircle size={12}/> Lỗi Đ/S</div>}
                              <button onClick={handleClearMatrix} className="text-[10px] text-red-400 border border-red-500/30 hover:bg-red-500/20 px-2 py-1 rounded flex items-center gap-1 font-bold transition-all"><Eraser size={12}/> XÓA SỐ</button>
                          </div>
                      </div>
                      <div className="overflow-x-auto p-2">
                          <table className="w-full text-left text-xs border-collapse min-w-[300px]">
                              <thead>
                                  <tr className="border-b border-gray-800 text-orange-400/80">
                                      <th className="py-2 px-1 font-black uppercase tracking-wider text-[10px]">Loại CH</th>
                                      <th className="py-2 px-1 text-center font-black" title="Biết">B</th>
                                      <th className="py-2 px-1 text-center font-black" title="Hiểu">H</th>
                                      <th className="py-2 px-1 text-center font-black" title="Vận dụng">VD</th>
                                      <th className="py-2 px-1 text-center font-black text-yellow-400">Tổng</th>
                                  </tr>
                              </thead>
                              <tbody className="text-gray-300 font-medium divide-y divide-gray-800/80">
                                  <tr>
                                      <td className="py-2 px-1 whitespace-nowrap text-[11px] font-bold">Trắc nghiệm</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.b} onChange={e=>handleMatrixChange('mcq', 'b', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.h} onChange={e=>handleMatrixChange('mcq', 'h', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.vd} onChange={e=>handleMatrixChange('mcq', 'vd', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400">{getTotalQ_Normal('mcq')} c</td>
                                  </tr>
                                  <tr>
                                      <td className="py-2 px-1 text-[11px] font-bold leading-tight">Đúng/Sai<br/><span className="text-[9px] text-orange-500 font-normal italic drop-shadow-sm">(Nhập số ý)</span></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.b} onChange={e=>handleMatrixChange('tf', 'b', e.target.value)} className={`w-8 sm:w-10 bg-gray-900 border rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all ${totalTF_Y > 0 && totalTF_Y % 4 !== 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-700 hover:border-orange-500/50'}`}/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.h} onChange={e=>handleMatrixChange('tf', 'h', e.target.value)} className={`w-8 sm:w-10 bg-gray-900 border rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all ${totalTF_Y > 0 && totalTF_Y % 4 !== 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-700 hover:border-orange-500/50'}`}/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.vd} onChange={e=>handleMatrixChange('tf', 'vd', e.target.value)} className={`w-8 sm:w-10 bg-gray-900 border rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all ${totalTF_Y > 0 && totalTF_Y % 4 !== 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-700 hover:border-orange-500/50'}`}/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400 leading-tight">{totalTF_Q} c<br/><span className="text-[9px] text-gray-500 font-normal">({totalTF_Y} ý)</span></td>
                                  </tr>
                                  <tr>
                                      <td className="py-2 px-1 whitespace-nowrap text-[11px] font-bold">Trả lời ngắn</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.b} onChange={e=>handleMatrixChange('sa', 'b', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.h} onChange={e=>handleMatrixChange('sa', 'h', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.vd} onChange={e=>handleMatrixChange('sa', 'vd', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400">{getTotalQ_Normal('sa')} c</td>
                                  </tr>
                                  <tr>
                                      <td className="py-2 px-1 whitespace-nowrap text-[11px] font-bold">Tự luận</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.b} onChange={e=>handleMatrixChange('essay', 'b', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.h} onChange={e=>handleMatrixChange('essay', 'h', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.vd} onChange={e=>handleMatrixChange('essay', 'vd', e.target.value)} className="w-8 sm:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400">{getTotalQ_Normal('essay')} c</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <button onClick={handleGenerateQuestions} disabled={loading} className={`relative w-full py-4 rounded-xl font-black uppercase tracking-widest text-white overflow-hidden group transition-all mt-4 ${loading ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' : 'border border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.6)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] active:scale-95'}`}>
                      {!loading && (
                          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 group-hover:scale-110 transition-transform duration-500"></div>
                      )}
                      <div className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? <Flame className="animate-bounce text-yellow-300" size={22}/> : <Zap size={22} className="text-yellow-300 fill-current animate-pulse"/>} 
                          {loading ? (isFetchingDoc ? 'ĐANG TẢI DỮ LIỆU...' : 'ĐANG ĐÚC ĐỀ THI...') : 'KHAI HỎA TẠO ĐỀ'}
                      </div>
                  </button>
              </div>
          </div>

          <div className="flex-1 bg-gray-900/80 overflow-y-auto p-4 md:p-8 custom-scrollbar shadow-[inset_10px_0_30px_rgba(0,0,0,0.5)]">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-orange-500">
                      <div className="relative mb-8">
                          <div className="absolute inset-0 bg-gradient-to-t from-red-600 to-yellow-400 blur-[60px] opacity-70 animate-pulse rounded-full w-24 h-24 md:w-32 md:h-32 -ml-6 -mt-6 md:-ml-8 md:-mt-8"></div>
                          <Flame size={70} className="md:w-[90px] md:h-[90px] text-yellow-400 relative z-10 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"/>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-2 text-center" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>LÒ PHẢN ỨNG ĐANG CHẠY</h3>
                      <p className="text-xs md:text-sm font-bold tracking-widest text-orange-200/60 animate-pulse text-center">{isFetchingDoc ? 'Đang đọc và phân tích tài liệu...' : 'Đang ép xung AI bám sát dữ liệu...'}</p>
                  </div>
              ) : resultMarkdown ? (
                  <div id="markdown-export-area" className="bg-white p-8 md:p-14 rounded-sm shadow-[0_0_40px_rgba(239,68,68,0.3)] border border-red-500/20 max-w-[1000px] mx-auto min-h-full text-black">
                      <h2 style={{ fontSize: '18pt', fontFamily: 'Times New Roman, serif', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', marginBottom: '24pt' }}>
                          {testTitle}
                      </h2>
                      
                      <div style={{ fontFamily: 'Times New Roman, serif', fontSize: '13pt', lineHeight: '1.4' }}>
                          <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeRaw, rehypeKatex]} 
                              components={{
                                      h3: ({node, ...props}) => <h3 style={{fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '24pt', marginBottom: '10pt', color: '#b91c1c', borderBottom: '2px solid #b91c1c', paddingBottom: '4px'}} {...props}/>,
                                      p: ({node, ...props}) => <p style={{margin: '6pt 0'}} {...props}/>,
                                      strong: ({node, ...props}) => <strong style={{fontWeight: 'bold', color: '#000'}} {...props}/>,
                                      ul: ({node, ...props}) => <ul style={{listStyleType: 'disc', paddingLeft: '24pt', margin: '6pt 0'}} {...props}/>,
                                      ol: ({node, ...props}) => <ol style={{listStyleType: 'decimal', paddingLeft: '24pt', margin: '6pt 0'}} {...props}/>,
                                      table: ({node, ...props}) => <div style={{overflowX: 'auto'}}><table style={{width: '100%', borderCollapse: 'collapse', marginTop: '12pt', marginBottom: '12pt', fontSize: '12pt'}} {...props}/></div>,
                                      th: ({node, ...props}) => <th style={{border: '1px solid black', padding: '8pt', backgroundColor: '#f8fafc', fontWeight: 'bold', textAlign: 'center'}} {...props}/>,
                                      td: ({node, ...props}) => <td style={{border: '1px solid black', padding: '8pt'}} {...props}/>,
                                      pre: ({node, ...props}) => <pre style={{backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10pt', borderRadius: '4pt', overflowX: 'auto', fontFamily: "'Courier New', Courier, monospace", fontSize: '11pt', margin: '8pt 0'}} {...props}/>,
                                      code: ({node, inline, ...props}) => inline ? <code style={{backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', color: '#e11d48', fontFamily: "'Courier New', Courier, monospace"}} {...props}/> : <code style={{fontFamily: "'Courier New', Courier, monospace"}} {...props}/>,
                                  }}
                          >
                              {resultMarkdown}
                          </ReactMarkdown>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-60">
                      <Target size={100} className="mb-6 drop-shadow-md text-gray-800"/>
                      <p className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-center text-blue-500 mb-2">
                          KHAI BÁO CẤU HÌNH<br/><span className="text-xs md:text-sm tracking-widest font-bold">ĐỂ BẮT ĐẦU TẠO ĐỀ CHUẨN</span>
                          <br/><span className="text-xs md:text-sm tracking-widest font-bold">Nguồn có thể lấy ở thư viện do admin cung cấp hoặc tự upload hoặc nhập tay</span>
                          <br/><span className="text-xs md:text-sm tracking-widest font-bold">Nhập phạm vi muốn tạo câu hỏi nếu sử dụng nguồn của Admin vì nguồn là 1 cuốn sách </span>
                          <br/><span className="text-xs md:text-sm tracking-widest font-bold">Nguồn tốt thì đề tạo ra tốt </span>
                      </p>
                  </div>
              )}
          </div>

      </div>
    </div>
  );
}