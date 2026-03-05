import { useState, useEffect } from 'react';
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
    ArrowLeft, Sparkles, Download, Loader2, Settings, 
    FileText, Target, BrainCircuit, Clock, PenTool, LayoutTemplate, AlertCircle, BookOpen,
    Upload, X, Flame // THÊM ICON FLAME
} from 'lucide-react';

const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];
const TEXTBOOKS = ["Kết nối tri thức", "Chân trời sáng tạo", "Cánh diều", "Khác"];

export default function FullTestGenerator() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // Thêm state authLoading để tránh văng trang
  
  const [subject, setSubject] = useState('Tin học');
  const [grade, setGrade] = useState('12');
  const [textbook, setTextbook] = useState('Kết nối tri thức');
  const [testTitle, setTestTitle] = useState('ĐỀ KIỂM TRA GIỮA HỌC KÌ 2');
  const [duration, setDuration] = useState(45);
  const [testScope, setTestScope] = useState(''); 
  
  // STATE CHO FILE UPLOAD
  const [uploadedText, setUploadedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [matrix, setMatrix] = useState({
      mcq: { b: 8, h: 2, vd: 2, point: 0.25 }, 
      tf: { b: 8, h: 4, vd: 4, point: 1.0 },   
      sa: { b: 0, h: 0, vd: 0, point: 0.5 },  
      essay: { b: 0, h: 1, vd: 1, point: 1.5 } 
  });

  const [loading, setLoading] = useState(false);
  const [resultMarkdown, setResultMarkdown] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // HÀM XỬ LÝ ĐỌC FILE (.txt, .docx)
  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileType = file.name.split('.').pop().toLowerCase();
      if (fileType !== 'txt' && fileType !== 'docx') {
          return alert("Hệ thống hiện tại chỉ hỗ trợ file .txt và .docx!");
      }

      setUploadedFileName(file.name);
      setIsExtracting(true);

      try {
          const reader = new FileReader();
          
          if (fileType === 'txt') {
              reader.onload = (event) => {
                  setUploadedText(event.target.result);
                  setIsExtracting(false);
              };
              reader.readAsText(file);
          } 
          else if (fileType === 'docx') {
              reader.onload = async (event) => {
                  const arrayBuffer = event.target.result;
                  const result = await mammoth.extractRawText({ arrayBuffer });
                  setUploadedText(result.value);
                  setIsExtracting(false);
              };
              reader.readAsArrayBuffer(file);
          }
      } catch (error) {
          console.error("Lỗi đọc file:", error);
          alert("Có lỗi xảy ra khi đọc file!");
          setIsExtracting(false);
          setUploadedFileName('');
      }
      
      e.target.value = null;
  };

  const clearUploadedFile = () => {
      setUploadedText('');
      setUploadedFileName('');
  };

  const handleMatrixChange = (type, level, value) => {
      let val = parseFloat(value);
      if (isNaN(val) || val < 0) val = 0;
      setMatrix(prev => ({
          ...prev,
          [type]: { ...prev[type], [level]: val }
      }));
  };

  const getTotalQ_Normal = (type) => matrix[type].b + matrix[type].h + matrix[type].vd;
  const totalTF_Y = matrix.tf.b + matrix.tf.h + matrix.tf.vd; 
  const totalTF_Q = totalTF_Y / 4; 
  
  const sumQuestions = getTotalQ_Normal('mcq') + totalTF_Q + getTotalQ_Normal('sa') + getTotalQ_Normal('essay');
  
  const sumScores = (getTotalQ_Normal('mcq') * matrix.mcq.point) + 
                    (totalTF_Q * matrix.tf.point) + 
                    (getTotalQ_Normal('sa') * matrix.sa.point) + 
                    (getTotalQ_Normal('essay') * matrix.essay.point);

  const totalB_Items = matrix.mcq.b + matrix.tf.b + matrix.sa.b + matrix.essay.b;
  const totalH_Items = matrix.mcq.h + matrix.tf.h + matrix.sa.h + matrix.essay.h;
  const totalVD_Items = matrix.mcq.vd + matrix.tf.vd + matrix.sa.vd + matrix.essay.vd;

  const totalB_Score = (matrix.mcq.b * matrix.mcq.point) + (matrix.tf.b * (matrix.tf.point / 4)) + (matrix.sa.b * matrix.sa.point) + (matrix.essay.b * matrix.essay.point);
  const totalH_Score = (matrix.mcq.h * matrix.mcq.point) + (matrix.tf.h * (matrix.tf.point / 4)) + (matrix.sa.h * matrix.sa.point) + (matrix.essay.h * matrix.essay.point);
  const totalVD_Score = (matrix.mcq.vd * matrix.mcq.point) + (matrix.tf.vd * (matrix.tf.point / 4)) + (matrix.sa.vd * matrix.sa.point) + (matrix.essay.vd * matrix.essay.point);

  const percentB = sumScores > 0 ? Math.round((totalB_Score / sumScores) * 100) : 0;
  const percentH = sumScores > 0 ? Math.round((totalH_Score / sumScores) * 100) : 0;
  const percentVD = sumScores > 0 ? Math.round((totalVD_Score / sumScores) * 100) : 0;

  const mcqScore = getTotalQ_Normal('mcq') * matrix.mcq.point;
  const tfScore = totalTF_Q * matrix.tf.point;
  const saScore = getTotalQ_Normal('sa') * matrix.sa.point;
  const essayScore = getTotalQ_Normal('essay') * matrix.essay.point;

  const mcqPercent = sumScores > 0 ? Math.round((mcqScore / sumScores) * 100) : 0;
  const tfPercent = sumScores > 0 ? Math.round((tfScore / sumScores) * 100) : 0;
  const saPercent = sumScores > 0 ? Math.round((saScore / sumScores) * 100) : 0;
  const essayPercent = sumScores > 0 ? Math.round((essayScore / sumScores) * 100) : 0;

  const handleGenerateTest = async () => {
    if (!testTitle.trim()) return alert("Vui lòng nhập Tiêu đề bài kiểm tra!");
    
    if (!testScope.trim() && !uploadedText.trim()) {
        return alert("Vui lòng nhập Phạm vi kiểm tra (VD: Từ bài 1 đến bài 4) hoặc Tải tệp Đề cương lên!");
    }
    
    if (totalTF_Y % 4 !== 0) {
        return alert(`CẢNH BÁO: Phần Đúng/Sai đang có tổng cộng ${totalTF_Y} ý.\nTheo quy định, mỗi câu phải có 4 ý (a,b,c,d).\nVui lòng điều chỉnh lại số lượng B, H, VD sao cho tổng chia hết cho 4!`);
    }

    if (sumScores !== 10) return alert(`Tổng điểm hiện tại là ${sumScores}đ. Vui lòng điều chỉnh lại Ma trận để tổng điểm bằng đúng 10.0đ!`);

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

        const contextPrompt = uploadedText 
            ? `\n**NGỮ LIỆU ĐẦU VÀO CỦA GIÁO VIÊN (SỐNG CÒN):**\n"""\n${uploadedText}\n"""\n\n**QUY TẮC BÁM SÁT NGỮ LIỆU (CHỐNG ẢO GIÁC):**\n1. Bạn BẮT BUỘC phải dựa 100% vào nội dung văn bản "NGỮ LIỆU ĐẦU VÀO" được cung cấp ở trên để tạo câu hỏi và ma trận.\n2. Mọi câu hỏi Trắc nghiệm, Đúng/Sai, Trả lời ngắn, Tự luận TUYỆT ĐỐI không được sử dụng kiến thức, số liệu hay thuật ngữ nằm ngoài văn bản này.\n3. Nếu có dữ liệu mâu thuẫn giữa kiến thức chung của bạn và "Ngữ liệu đầu vào", BẮT BUỘC phải tuân theo "Ngữ liệu đầu vào".\n`
            : "";

        const prompt = `
Bạn là một Chuyên gia Khảo thí giáo dục. Hãy tạo một Bộ Đề Kiểm Tra đầy đủ 4 phần chuẩn form cấu trúc 2025 của Bộ GD&ĐT.

**THÔNG TIN ĐỀ THI:**
- Môn: ${subject} - Lớp: ${grade}
- Sách giáo khoa: ${textbook}
- Tiêu đề: ${testTitle}
- Thời gian: ${duration} phút
- PHẠM VI KIẾN THỨC BỔ SUNG: """${testScope}"""
${contextPrompt}

**QUY TẮC SÁCH GIÁO KHOA VÀ NỘI DUNG (SỐNG CÒN - KHÔNG ĐƯỢC LÀM SAI):**
1. LẤY CHÍNH XÁC TÊN BÀI: Dựa vào "Phạm vi kiến thức" hoặc "Ngữ liệu" được giao, BẮT BUỘC phải tra cứu và sử dụng ĐÚNG TÊN BÀI HỌC. TUYỆT ĐỐI KHÔNG BỊA TÊN BÀI.
2. BÁM SÁT KIẾN THỨC 100%: Mọi câu hỏi (trắc nghiệm, đúng sai, trả lời ngắn, tự luận) BẮT BUỘC phải nằm hoàn toàn trong nội dung kiến thức của bộ sách "${textbook}" hoặc Ngữ liệu đã cho.

**CẤU TRÚC MA TRẬN YÊU CẦU:**
1. Phần I. Trắc nghiệm nhiều lựa chọn: Tổng ${getTotalQ_Normal('mcq')} câu (Biết: ${matrix.mcq.b}, Hiểu: ${matrix.mcq.h}, Vận dụng: ${matrix.mcq.vd}).
    - Câu hỏi bám sát sách giáo khoa nhưng có tình huống thực tế, hoặc câu hỏi mở rộng để đánh giá đúng năng lực. Không trả lời kiểu tất cả đều đúng.
2. Phần II. Trắc nghiệm Đúng/Sai: Gồm tổng cộng ${totalTF_Q} câu. (Mỗi câu bắt buộc có 4 ý a, b, c, d). Phân bổ số ý: Biết ${matrix.tf.b} ý, Hiểu ${matrix.tf.h} ý, Vận dụng ${matrix.tf.vd} ý.
   - Bắt buộc TRỘN LẪN các mức độ nhận thức (Biết, Hiểu, Vận dụng) vào 4 ý của cùng một câu hỏi.
   - Tổng số lượng các ý phân bổ toàn phần II phải khớp chính xác.
   - LỜI DẪN LÀ MỘT TÌNH HUỐNG TRONG THỰC TẾ BÁM SÁT NỘI DUNG BÀI HỌC CÓ ĐỘ DÀI KHOẢNG 2-3 DÒNG.
3. Phần III. Trả lời ngắn: Tổng ${getTotalQ_Normal('sa')} câu (Biết: ${matrix.sa.b}, Hiểu: ${matrix.sa.h}, Vận dụng: ${matrix.sa.vd}).
4. Phần IV. Tự luận: Tổng ${getTotalQ_Normal('essay')} câu (Biết: ${matrix.essay.b}, Hiểu: ${matrix.essay.h}, Vận dụng: ${matrix.essay.vd}).

**QUY TẮC ĐỒNG BỘ MA TRẬN VÀ ĐẶC TẢ (SỐNG CÒN - NGHIÊM CẤM LÀM SAI):**
1. TUYỆT ĐỐI KHÔNG GỘP CHUNG VÀO 1 HÀNG: Phải phân tách "Phạm vi kiến thức" thành ít nhất 2 đến 4 "Chủ đề/Chương" (hàng) khác nhau. Hãy rải đều số lượng câu hỏi vào các hàng này.
2. ĐỒNG BỘ 100%: Nội dung của Cột "Chủ đề/Chương" và Cột "Nội dung/đơn vị kiến thức" ở BẢNG MA TRẬN (Phần 1) BẮT BUỘC PHẢI GIỐNG HỆT 100% với BẢNG ĐẶC TẢ (Phần 2). Không được sai lệch dù chỉ 1 chữ.
3. TÊN BÀI CHÍNH XÁC: Nếu phạm vi kiến thức chứa tên bài, BẮT BUỘC lấy đúng tên bài đó (trong sách giáo khoa), TUYỆT ĐỐI KHÔNG bịa thêm hay sửa tên bài.
**QUY TẮC TÍNH CỘT "TỈ LỆ % ĐIỂM" TRONG BẢNG MA TRẬN (SỐNG CÒN):**
Tại bảng Ma trận Phần 1, đối với MỖI HÀNG nội dung kiến thức mà bạn tạo ra, BẮT BUỘC phải tính và điền kết quả vào cột cuối cùng ("Tỉ lệ % điểm"). 
- Hệ số điểm để tính: Trắc nghiệm = ${matrix.mcq.point}đ/câu; 1 ý Đúng/Sai = ${matrix.tf.point / 4}đ/ý; Trả lời ngắn = ${matrix.sa.point}đ/câu; Tự luận = ${matrix.essay.point}đ/câu.
- CÁCH TÍNH: Lấy tổng điểm của tất cả các câu hỏi trong hàng đó chia cho 10.0, rồi nhân với 100. (Ví dụ: Hàng có tổng 1.5 điểm -> Tỉ lệ là 15%).
- Ghi kèm ký tự "%" vào kết quả. TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỂ TRỐNG CỘT NÀY.
**QUY TẮC TÍNH ĐIỂM (NGHIÊM CẤM TỰ TÍNH):**
Tại bảng Ma trận Phần 1, phần TỔNG ĐIỂM của mỗi cột, bạn TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ TÍNH. Hãy điền các chuỗi sau đây vào ô tương ứng (Hệ thống sẽ tự động thay thế bằng số chính xác):
- Cột MCQ (Biết): ##DIEM_MCQ_B##
- Cột MCQ (Hiểu): ##DIEM_MCQ_H##
- Cột MCQ (Vận dụng): ##DIEM_MCQ_VD##
- Cột Đúng Sai (Biết): ##DIEM_TF_B##
- Cột Đúng Sai (Hiểu): ##DIEM_TF_H##
- Cột Đúng Sai (Vận dụng): ##DIEM_TF_VD##
- Cột Trả lời ngắn (Biết): ##DIEM_SA_B##
- Cột Trả lời ngắn (Hiểu): ##DIEM_SA_H##
- Cột Trả lời ngắn (Vận dụng): ##DIEM_SA_VD##
- Cột Tự luận (Biết): ##DIEM_ES_B##
- Cột Tự luận (Hiểu): ##DIEM_ES_H##
- Cột Tự luận (Vận dụng): ##DIEM_ES_VD##

**QUY TẮC ĐỊNH DẠNG CÂU HỎI & ĐÁP ÁN (SỐNG CÒN):**
- SỐ THỨ TỰ CÂU: MỖI PHẦN (Trắc nghiệm, Đúng/Sai, Trả lời ngắn, Tự luận) BẮT BUỘC PHẢI ĐÁNH SỐ LẠI TỪ CÂU 1. TUYỆT ĐỐI KHÔNG đánh số nối tiếp từ phần này sang phần khác.
- ĐÁP ÁN TRẮC NGHIỆM: Thêm ký tự sao (*) viết liền trước đáp án/ý ĐÚNG (VD: *A. hoặc *B. ).
- ĐÁP ÁN CÂU ĐÚNG/SAI: BẮT BUỘC thêm ký tự sao (*) viết liền trước chữ cái của phát biểu đúng (Ví dụ phát biểu a đúng thì viết là *a) ). KHÔNG thêm dấu (*) vào trước chữ Đ/S ở bảng đáp án.
- TIÊU ĐỀ CÂU ĐÚNG/SAI: Tuyệt đối KHÔNG ghi các từ (Biết), (Hiểu), (Vận dụng) cạnh tiêu đề Câu 1, Câu 2 của phần Đúng/Sai. Hãy để ngầm định.
- ÉP BUỘC XUỐNG DÒNG: Các phương án (A, B, C, D) và (a, b, c, d) PHẢI xuống dòng (Enter 2 lần).
- TRẢ LỜI NGẮN: Dưới mỗi câu hỏi Trả lời ngắn, ghi: "Key: đáp án". TUYỆT ĐỐI KHÔNG dùng dấu ngoặc vuông.
- MÃ CODE LẬP TRÌNH: TRONG PHẦN ĐỀ THI, BẮT BUỘC bọc code bằng \`\`\`python (hoặc C++) để tạo hộp. Không đưa chữ tiếng Việt hay Code vào trong thẻ $...$.
- TOÁN HỌC/LÝ/HÓA: 
    +Công thức PHỨC TẠP NHƯ: CĂN BẬC HAI,BA, GIỚI HẠN, MŨ, LUỸ THỪA,LOG,...BẮT BUỘC dùng LaTeX kẹp trong $...$. BẮT BUỘC gõ khoảng trắng (space) TRƯỚC và SAU mỗi công thức $...$. KHÔNG dùng dấu nháy hay backtick bao quanh công thức.
    +Công thức đơn giản như biểu thức, phương trình bậc nhất,.. không bắt buộc phải dùng LaTeX, có thể viết trực tiếp trong câu hỏi.Ví dụ: x=2, 2x+4=0,... Nhưng nếu dùng LaTeX thì vẫn phải tuân thủ quy tắc có khoảng trắng trước và sau công thức.
- BẮT ĐẦU VĂN BẢN TỪ "### **PHẦN 1: MA TRẬN ĐỀ KIỂM TRA**", TUYỆT ĐỐI KHÔNG CHÀO HỎI.
- Viết Code Python/C++ trong đề, phần Đáp án và Hướng dẫn chấm nếu có 1 dòng thì không cần định dạng LaTeX ví dụ: len(s), s.insert(k,x),..., nhưng nếu có nhiều dòng code hoặc công thức phức tạp thì BẮT BUỘC phải định dạng LaTeX hoặc code để đảm bảo tính rõ ràng và dễ đọc. KHÔNG được viết code hay công thức phức tạp liền mạch trong một đoạn văn bản dài mà không có định dạng rõ ràng.
**BẠN PHẢI TRẢ VỀ ĐÚNG 4 PHẦN THEO THỨ TỰ DƯỚI ĐÂY:**

### **PHẦN 1: MA TRẬN ĐỀ KIỂM TRA**
BẮT BUỘC copy y nguyên khối HTML dưới đây để tạo bảng. Không dùng Markdown.
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
      <td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>${totalB_Items}</td><td>${totalH_Items}</td><td>${totalVD_Items}</td><td></td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="3">Tổng số điểm</td>
      <td>##DIEM_MCQ_B##</td><td>##DIEM_MCQ_H##</td><td>##DIEM_MCQ_VD##</td>
      <td>##DIEM_TF_B##</td><td>##DIEM_TF_H##</td><td>##DIEM_TF_VD##</td>
      <td>##DIEM_SA_B##</td><td>##DIEM_SA_H##</td><td>##DIEM_SA_VD##</td>
      <td>##DIEM_ES_B##</td><td>##DIEM_ES_H##</td><td>##DIEM_ES_VD##</td>
      <td>${totalB_Score}</td><td>${totalH_Score}</td><td>${totalVD_Score}</td><td>${sumScores}</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="3">Tỉ lệ %</td>
      <td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>${percentB}%</td><td>${percentH}%</td><td>${percentVD}%</td><td>100%</td>
    </tr>
  </tbody>
</table>

### **PHẦN 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA**
BẮT BUỘC copy y nguyên khối HTML dưới đây để tạo bảng Đặc tả. Thêm \`style="text-align: left;"\` vào \`<td>\` cột 2, 3, 4.
**QUY TẮC ĐIỀN DỮ LIỆU ĐẶC TẢ:**
1. Các hàng ở cột "Chủ đề/Chương" và "Nội dung" BẮT BUỘC phải copy y hệt như trên bảng Ma trận ở Phần 1. Nhắc lại: PHẢI GIỮ ĐÚNG TÊN BÀI THEO SÁCH GIÁO KHOA NẾU CÓ.
2. Cột "Yêu cầu cần đạt", dùng thẻ <br> để chia rõ 3 mức độ: + Biết: [...] <br> + Hiểu: [...] <br> + Vận dụng: [...]
3. Cột điền Số câu hỏi: BẮT BUỘC ghi số lượng câu, KÈM THEO VỊ TRÍ CÂU HỎI TRONG ĐỀ THI (để trong ngoặc đơn) và Mã năng lực đặc thù bên dưới (dùng thẻ <br>).
   *Ví dụ mẫu:* 2 (câu 1, 2) <br> (NLa) hoặc 4 (ý a,b câu 1) <br> (TH).
   *LƯU Ý: ${competencyGuidance}*

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
    </tr>
  </thead>
  <tbody>
    <tr style="font-weight:bold;">
      <td colspan="4">Tổng số câu</td>
      <td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="4">Tổng số điểm</td>
      <td colspan="3">${mcqScore}</td>
      <td colspan="3">${tfScore}</td>
      <td colspan="3">${saScore}</td>
      <td colspan="3">${essayScore}</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="4">Tỉ lệ %</td>
      <td colspan="3">${mcqPercent}%</td>
      <td colspan="3">${tfPercent}%</td>
      <td colspan="3">${saPercent}%</td>
      <td colspan="3">${essayPercent}%</td>
    </tr>
  </tbody>
</table>

### **PHẦN 3: ĐỀ KIỂM TRA**
(Ghi chính xác các dòng Tiêu đề sau, không được thiếu sót:)
**PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.** Thí sinh trả lời từ câu 1 đến câu ${getTotalQ_Normal('mcq')}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
(Nội dung các câu hỏi...)

**PHẦN II. Câu trắc nghiệm đúng sai.** Thí sinh trả lời từ câu 1 đến câu ${totalTF_Q}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.
**Câu 1:** Lời dẫn tình huống... 
a) Nội dung ý...
b) Nội dung ý...

${getTotalQ_Normal('sa') > 0 ? `**PHẦN III. Câu trắc nghiệm trả lời ngắn.** Thí sinh trả lời từ câu 1 đến câu ${getTotalQ_Normal('sa')}.
(Nội dung các câu hỏi... Nhớ thêm Key: đáp án, TUYỆT ĐỐI KHÔNG dùng ngoặc vuông)

**PHẦN IV. Tự luận.**` : `**PHẦN III. Tự luận.**`}
(Nội dung các câu hỏi Tự luận. LƯU Ý SỐNG CÒN: Đánh số câu Tự luận phải RESET BẮT ĐẦU LẠI TỪ Câu 1, Câu 2... TUYỆT ĐỐI KHÔNG nối tiếp số thứ tự của các phần trước).

### **PHẦN 4: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM**
1. Bảng đáp án Phần I và Phần II (Dùng bảng Markdown).
2. Bảng Hướng dẫn chấm Phần Tự luận / Trả lời ngắn: BẮT BUỘC DÙNG BẢNG MARKDOWN DƯỚI ĐÂY.
| Câu | Nội dung đáp án / Code / Công thức | Điểm |
|:---:|---|:---:|
| 1 | Lời giải dòng 1 <br> Lời giải dòng 2 | 1.0 |
- LUẬT THÉP BẢO VỆ BẢNG ĐÁP ÁN MARKDOWN:
  + TRONG BẢNG NÀY TUYỆT ĐỐI KHÔNG SỬ DỤNG BA DẤU GẠCH NGƯỢC (\`\`\`) ĐỂ VIẾT CODE VÌ SẼ LÀM VỠ BẢNG.
  + Mọi nội dung, kể cả Code Python/C++ trong bảng này BẮT BUỘC phải dùng thẻ <br> để xuống dòng, viết liền mạch trên 1 hàng ngang của bảng.
        `;

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();

        textResult = textResult.replace('##DIEM_MCQ_B##', matrix.mcq.b === 0 ? '0' : (matrix.mcq.b * matrix.mcq.point).toString());
        textResult = textResult.replace('##DIEM_MCQ_H##', matrix.mcq.h === 0 ? '0' : (matrix.mcq.h * matrix.mcq.point).toString());
        textResult = textResult.replace('##DIEM_MCQ_VD##', matrix.mcq.vd === 0 ? '0' : (matrix.mcq.vd * matrix.mcq.point).toString());
        
        textResult = textResult.replace('##DIEM_TF_B##', matrix.tf.b === 0 ? '0' : (matrix.tf.b * (matrix.tf.point / 4)).toString());
        textResult = textResult.replace('##DIEM_TF_H##', matrix.tf.h === 0 ? '0' : (matrix.tf.h * (matrix.tf.point / 4)).toString());
        textResult = textResult.replace('##DIEM_TF_VD##', matrix.tf.vd === 0 ? '0' : (matrix.tf.vd * (matrix.tf.point / 4)).toString());

        textResult = textResult.replace('##DIEM_SA_B##', matrix.sa.b === 0 ? '0' : (matrix.sa.b * matrix.sa.point).toString());
        textResult = textResult.replace('##DIEM_SA_H##', matrix.sa.h === 0 ? '0' : (matrix.sa.h * matrix.sa.point).toString());
        textResult = textResult.replace('##DIEM_SA_VD##', matrix.sa.vd === 0 ? '0' : (matrix.sa.vd * matrix.sa.point).toString());

        textResult = textResult.replace('##DIEM_ES_B##', matrix.essay.b === 0 ? '0' : (matrix.essay.b * matrix.essay.point).toString());
        textResult = textResult.replace('##DIEM_ES_H##', matrix.essay.h === 0 ? '0' : (matrix.essay.h * matrix.essay.point).toString());
        textResult = textResult.replace('##DIEM_ES_VD##', matrix.essay.vd === 0 ? '0' : (matrix.essay.vd * matrix.essay.point).toString());

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
        alert("Lỗi tạo đề: " + error.message);
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
                  @page Section1 {
                      size: 841.9pt 595.3pt; 
                      mso-page-orientation: landscape;
                      margin: 28.3pt 28.3pt 28.3pt 42.5pt; 
                      mso-header-margin: 35.4pt;
                      mso-footer-margin: 35.4pt;
                      mso-paper-source: 0;
                  }
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

                  pre {
                      background-color: #f8fafc;
                      border: 1px solid #cbd5e1;
                      padding: 8pt;
                      border-radius: 4pt;
                      font-family: 'Courier New', Courier, monospace;
                      font-size: 11pt;
                      white-space: pre-wrap;
                      margin: 6pt 0;
                  }
                  code {
                      font-family: 'Courier New', Courier, monospace;
                      background-color: #f1f5f9;
                      padding: 2px 4px;
                      border-radius: 3px;
                  }
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
      fileDownload.download = `Bo_De_Ngang_${subject}_Lop${grade}_${testTitle.replace(/\s+/g, '_')}.doc`;
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
      
      {/* GLOWING BACKGROUND ORB */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-600/20 blur-[150px] rounded-full pointer-events-none"></div>

      {/* HEADER */}
      <header className="h-[70px] bg-black/80 backdrop-blur-md border-b border-red-500/40 shadow-[0_4px_30px_rgba(239,68,68,0.3)] px-6 flex justify-between items-center shrink-0 z-10 relative">
         <div className="flex items-center gap-4">
             <button onClick={() => router.push('/')} className="p-2 bg-gray-900 border border-red-500/30 hover:bg-red-950/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-xl transition-all"><ArrowLeft size={20} className="text-orange-400"/></button>
             <div>
                 <h1 className="text-2xl font-black uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600" style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
                     AI SOẠN ĐỀ FULL
                 </h1>
                 <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest">Ma trận - Bản đặc tả - Đề thi - Đáp án</p>
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
          <div className="w-full lg:w-[460px] bg-black/60 backdrop-blur-md border-r border-orange-500/30 shadow-[5px_0_30px_rgba(249,115,22,0.1)] overflow-y-auto p-4 custom-scrollbar shrink-0">
              
              <div className="space-y-4">
                  {/* CẤU HÌNH CƠ BẢN */}
                  <div className="bg-gray-950/50 p-4 rounded-xl border border-white/5 space-y-3">
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

                      <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                              <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1"><BookOpen size={12}/> Sách giáo khoa</label>
                              <select value={textbook} onChange={e=>setTextbook(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm transition-all">
                                  {TEXTBOOKS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          </div>
                          <div className="col-span-1">
                              <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Thời gian</label>
                              <input type="number" min="15" value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm text-center transition-all"/>
                          </div>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-orange-400/80 uppercase tracking-wider mb-1.5">Tiêu đề Bài kiểm tra</label>
                          <input value={testTitle} onChange={e=>setTestTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 font-bold text-sm transition-all" placeholder="VD: ĐỀ KIỂM TRA GIỮA KÌ 1"/>
                      </div>
                  </div>

                  {/* KHỐI GIAO DIỆN UPLOAD VÀ NHẬP PHẠM VI */}
                  <div className="relative group p-4 rounded-xl border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)] bg-gray-950/80 transition-all hover:border-orange-500/60">
                      <div className="flex justify-between items-end mb-3">
                          <label className="block text-[10px] font-black text-red-500 uppercase tracking-wider drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">Phạm vi (Nhập tay / Tải tệp)</label>
                          
                          <input 
                              type="file" 
                              id="file-upload" 
                              accept=".txt, .docx" 
                              onChange={handleFileUpload} 
                              className="hidden" 
                          />
                          <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-1 bg-gradient-to-r from-orange-600/80 to-red-600/80 hover:from-orange-500 hover:to-red-500 text-white px-3 py-1.5 rounded border border-orange-400/50 text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(249,115,22,0.4)] transition-all">
                              {isExtracting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                              {isExtracting ? 'ĐANG ĐỌC...' : 'TẢI ĐỀ CƯƠNG'}
                          </label>
                      </div>

                      {uploadedFileName && (
                          <div className="flex justify-between items-center bg-gray-900 border border-orange-500/50 p-2 mb-3 rounded-lg text-xs shadow-[inset_0_0_10px_rgba(249,115,22,0.2)]">
                              <div className="flex items-center gap-2 truncate text-orange-300">
                                  <FileText size={14} className="text-orange-500 shrink-0 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                                  <span className="truncate">Đã tải: <strong>{uploadedFileName}</strong></span>
                              </div>
                              <button onClick={clearUploadedFile} className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-md shrink-0 transition-colors">
                                  <X size={14} />
                              </button>
                          </div>
                      )}

                      <textarea 
                          value={testScope} 
                          onChange={e=>setTestScope(e.target.value)} 
                          rows={2} 
                          className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500/50 p-2.5 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-100 text-xs transition-all shadow-inner custom-scrollbar" 
                          placeholder="VD: Bài 1:... (Càng chi tiết đề càng chính xác. Nếu đã tải tệp, có thể bỏ trống)"
                      />
                  </div>

                  {/* BẢNG MA TRẬN */}
                  <div className="bg-gray-950 rounded-xl border border-orange-500/30 overflow-hidden shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                      <div className="bg-gray-900 border-b border-orange-500/30 p-3 flex justify-between items-center">
                          <label className="block text-xs font-black text-orange-400 uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]"><LayoutTemplate size={16}/> Cấu hình Ma trận</label>
                          {totalTF_Y % 4 !== 0 && <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]"><AlertCircle size={12}/> Lỗi ý Đ/S</div>}
                      </div>
                      <div className="overflow-x-auto p-2">
                          <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                  <tr className="border-b border-gray-800 text-orange-400/80">
                                      <th className="py-2 px-1 font-black uppercase tracking-wider text-[10px]">Loại CH</th>
                                      <th className="py-2 px-1 text-center font-black" title="Biết">B</th>
                                      <th className="py-2 px-1 text-center font-black" title="Hiểu">H</th>
                                      <th className="py-2 px-1 text-center font-black" title="Vận dụng">VD</th>
                                      <th className="py-2 px-1 text-center font-black text-yellow-400">Tổng</th>
                                      <th className="py-2 px-1 text-center font-black uppercase tracking-wider text-[10px]">Điểm/Câu</th>
                                  </tr>
                              </thead>
                              <tbody className="text-gray-300 font-medium divide-y divide-gray-800/80">
                                  <tr>
                                      <td className="py-2 px-1 whitespace-nowrap text-[11px] font-bold">Trắc nghiệm</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.b} onChange={e=>handleMatrixChange('mcq', 'b', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.h} onChange={e=>handleMatrixChange('mcq', 'h', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.vd} onChange={e=>handleMatrixChange('mcq', 'vd', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400">{getTotalQ_Normal('mcq')} c</td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.mcq.point} onChange={e=>handleMatrixChange('mcq', 'point', e.target.value)} className="w-12 md:w-14 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-orange-400 font-bold transition-all"/></td>
                                  </tr>
                                  <tr>
                                      <td className="py-2 px-1 text-[11px] font-bold leading-tight">Đúng/Sai<br/><span className="text-[9px] text-orange-500 font-normal italic drop-shadow-sm">(Nhập số Lệnh hỏi)</span></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.b} onChange={e=>handleMatrixChange('tf', 'b', e.target.value)} className={`w-8 md:w-10 bg-gray-900 border rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all ${totalTF_Y % 4 !== 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-700 hover:border-orange-500/50'}`}/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.h} onChange={e=>handleMatrixChange('tf', 'h', e.target.value)} className={`w-8 md:w-10 bg-gray-900 border rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all ${totalTF_Y % 4 !== 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-700 hover:border-orange-500/50'}`}/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.vd} onChange={e=>handleMatrixChange('tf', 'vd', e.target.value)} className={`w-8 md:w-10 bg-gray-900 border rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all ${totalTF_Y % 4 !== 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-700 hover:border-orange-500/50'}`}/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400 leading-tight">
                                          {totalTF_Q} c<br/><span className="text-[9px] text-gray-500 font-normal">({totalTF_Y} ý)</span>
                                      </td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.tf.point} onChange={e=>handleMatrixChange('tf', 'point', e.target.value)} className="w-12 md:w-14 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-orange-400 font-bold transition-all"/></td>
                                  </tr>
                                  <tr>
                                      <td className="py-2 px-1 whitespace-nowrap text-[11px] font-bold">Trả lời ngắn</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.b} onChange={e=>handleMatrixChange('sa', 'b', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.h} onChange={e=>handleMatrixChange('sa', 'h', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.vd} onChange={e=>handleMatrixChange('sa', 'vd', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400">{getTotalQ_Normal('sa')} c</td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.sa.point} onChange={e=>handleMatrixChange('sa', 'point', e.target.value)} className="w-12 md:w-14 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-orange-400 font-bold transition-all"/></td>
                                  </tr>
                                  <tr>
                                      <td className="py-2 px-1 whitespace-nowrap text-[11px] font-bold">Tự luận</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.b} onChange={e=>handleMatrixChange('essay', 'b', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.h} onChange={e=>handleMatrixChange('essay', 'h', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.vd} onChange={e=>handleMatrixChange('essay', 'vd', e.target.value)} className="w-8 md:w-10 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-white transition-all"/></td>
                                      <td className="p-1 text-center font-bold text-yellow-400">{getTotalQ_Normal('essay')} c</td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.essay.point} onChange={e=>handleMatrixChange('essay', 'point', e.target.value)} className="w-12 md:w-14 bg-gray-900 border border-gray-700 hover:border-orange-500/50 rounded text-center outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.4)] p-1 text-orange-400 font-bold transition-all"/></td>
                                  </tr>
                              </tbody>
                              <tfoot className="border-t border-orange-500/50 bg-gray-900/80 font-bold text-orange-200">
                                  <tr>
                                      <td className="py-3 px-1 text-[10px] uppercase tracking-wider text-orange-400">Tổng/Tỉ lệ</td>
                                      <td className="p-1 text-center border-l border-gray-800">
                                          <div className="text-white text-sm">{totalB_Items}</div>
                                          <div className="text-[10px] text-green-400 drop-shadow-sm">{percentB}%</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-gray-800">
                                          <div className="text-white text-sm">{totalH_Items}</div>
                                          <div className="text-[10px] text-blue-400 drop-shadow-sm">{percentH}%</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-gray-800">
                                          <div className="text-white text-sm">{totalVD_Items}</div>
                                          <div className="text-[10px] text-purple-400 drop-shadow-sm">{percentVD}%</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-gray-800">
                                          <div className="text-white text-sm font-black text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">{sumQuestions}c</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-gray-800">
                                          <div className={`text-sm font-black drop-shadow-md ${sumScores === 10 ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>{sumScores.toFixed(2)}đ</div>
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>

                  {/* ACTION BUTTON MANG SỨC MẠNH CỦA LỬA */}
                  <button onClick={handleGenerateTest} disabled={loading} className={`relative w-full py-4 rounded-xl font-black uppercase tracking-widest text-white overflow-hidden group transition-all mt-4 ${loading ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' : 'border border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.6)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] active:scale-95'}`}>
                      {!loading && (
                          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 group-hover:scale-110 transition-transform duration-500"></div>
                      )}
                      <div className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? <Flame className="animate-bounce text-yellow-300" size={22}/> : <Sparkles size={22}/>} 
                          {loading ? 'ĐANG NUNG CHẢY & ĐÚC ĐỀ...' : 'KHAI HỎA TẠO ĐỀ'}
                      </div>
                  </button>
              </div>
          </div>

          {/* RIGHT PANEL - PREVIEW AREA */}
          <div className="flex-1 bg-gray-900/80 overflow-y-auto relative p-4 md:p-8 custom-scrollbar shadow-[inset_10px_0_30px_rgba(0,0,0,0.5)]">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-orange-500">
                      <div className="relative mb-8">
                          <div className="absolute inset-0 bg-gradient-to-t from-red-600 to-yellow-400 blur-[60px] opacity-70 animate-pulse rounded-full w-32 h-32 -ml-8 -mt-8"></div>
                          <Flame size={90} className="text-yellow-400 relative z-10 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"/>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-2" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>LÒ PHẢN ỨNG ĐANG CHẠY</h3>
                      <p className="text-sm font-bold tracking-widest text-orange-200/60 animate-pulse">Quá trình ép xung AI đang diễn ra...</p>
                  </div>
              ) : resultMarkdown ? (
                  <div 
                      className="bg-white p-8 md:p-14 rounded-sm shadow-[0_0_40px_rgba(239,68,68,0.3)] border border-red-500/20 max-w-[1200px] mx-auto min-h-full text-black" 
                      id="markdown-export-area"
                  >
                      <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt', marginBottom: '16pt' }}>
                          <h2 style={{ fontSize: '16pt', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', marginBottom: '4pt' }}>
                              {testTitle}
                          </h2>
                          <h5 style={{ fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', marginTop: 0, marginBottom: '24pt' }}>
                              Môn: {subject} {grade} ({textbook}) - Thời gian: {duration} phút
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
                                  th: ({node, ...props}) => <th style={{border: '1px solid black', padding: '6pt', backgroundColor: '#f8fafc', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle'}} {...props}/>,
                                  td: ({node, ...props}) => <td style={{border: '1px solid black', padding: '6pt', verticalAlign: 'top'}} {...props}/>,
                                  pre: ({node, ...props}) => <pre style={{backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10pt', borderRadius: '4pt', overflowX: 'auto', fontFamily: "'Courier New', Courier, monospace", fontSize: '11pt', margin: '8pt 0'}} {...props}/>,
                                  code: ({node, inline, ...props}) => inline ? <code style={{backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', fontFamily: "'Courier New', Courier, monospace", color: '#e11d48'}} {...props}/> : <code style={{fontFamily: "'Courier New', Courier, monospace"}} {...props}/>,
                              }}
                          >
                              {resultMarkdown}
                          </ReactMarkdown>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-60">
                      <div className="relative mb-6">
                          <Target size={120} className="text-gray-800 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]"/>
                      </div>
                      <p className="text-2xl font-black uppercase tracking-[0.2em] text-center text-gray-600 drop-shadow-md">KHAI BÁO CẤU HÌNH<br/><span className="text-sm font-bold tracking-widest text-gray-500">ĐỂ BẮT ĐẦU TẠO ĐỀ</span></p>
                                  <br/><span className="text-xs md:text-sm tracking-widest font-bold">Nguồn tự upload hoặc nhập tay ô phạm vi</span>
                                  <br/><span className="text-xs md:text-sm tracking-widest font-bold">Nguồn tốt thì đề tạo ra tốt </span>
                  </div>
              )}
          </div>

      </div>
    </div>
  );
}