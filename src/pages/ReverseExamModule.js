import { useState, useEffect, useRef } from 'react';
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
import { 
    ArrowLeft, Sparkles, Download, Loader2, Settings, 
    FileText, Target, BrainCircuit, Clock, PenTool, LayoutTemplate, AlertCircle,
    UploadCloud, FileSearch // <-- Thêm icon cho phần upload
} from 'lucide-react';

const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];

export default function ReverseGenerator() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  
  const [subject, setSubject] = useState('Toán học'); // Đổi default phù hợp test
  const [grade, setGrade] = useState('12');
  const [testTitle, setTestTitle] = useState('ĐỀ KIỂM TRA GIỮA HỌC KÌ 1');
  const [duration, setDuration] = useState(90);
  const [testScope, setTestScope] = useState(''); 
  
  const [matrix, setMatrix] = useState({
      mcq: { b: 4, h: 4, vd: 4, point: 0.25 }, 
      tf: { b: 8, h: 4, vd: 4, point: 1.0 },   
      sa: { b: 0, h: 0, vd: 0, point: 0.25 },  
      essay: { b: 0, h: 1, vd: 1, point: 1.5 } 
  });

  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // State mới cho việc AI bóc tách
  const [resultMarkdown, setResultMarkdown] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
    });
    return () => unsubscribe();
  }, [router]);

  const handleMatrixChange = (type, level, value) => {
      let val = parseFloat(value);
      if (isNaN(val) || val < 0) val = 0;
      setMatrix(prev => ({
          ...prev,
          [type]: { ...prev[type], [level]: val }
      }));
  };

  // --- CÁC HÀM TÍNH TOÁN CŨ GIỮ NGUYÊN ---
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

  // --- HÀM MỚI: CHUYỂN FILE SANG BASE64 CHO GEMINI ---
  const fileToGenerativePart = async (file) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  // --- HÀM MỚI: AI ĐỌC VÀ BÓC TÁCH ĐỀ GỐC ---
  const handleAnalyzeFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Chỉ chấp nhận PDF (Gemini Vision đọc PDF rất tốt)
    if (file.type !== "application/pdf") {
        return alert("Vui lòng tải lên file định dạng PDF để AI đọc chuẩn xác nhất.");
    }

    setIsAnalyzing(true);
    try {
        const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
        if (!userConfigDoc.exists() || !userConfigDoc.data().geminiKey) {
            throw new Error("Chưa cấu hình Gemini API Key trong menu Cấu Hình!");
        }
        
        const config = userConfigDoc.data();
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        // Bắt buộc dùng model PRO để đọc file PDF phức tạp
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const filePart = await fileToGenerativePart(file);
        
        const prompt = `
            Bạn là chuyên gia phân tích đề thi. Hãy đọc kỹ file PDF đề thi đính kèm.
            Nhiệm vụ: Trích xuất cấu trúc ma trận điểm và tóm tắt phạm vi kiến thức.
            BẮT BUỘC TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ (Không có markdown block \`\`\`json).
            Cấu trúc JSON yêu cầu:
            {
              "testScope": "Tóm tắt ngắn gọn các chủ đề/chương có trong đề thi này (VD: Hàm số, Khảo sát đồ thị, Dãy số...)",
              "matrix": {
                "mcq": { "b": [số câu Nhận biết], "h": [số câu Thông hiểu], "vd": [số câu Vận dụng/VDC] },
                "tf": { "b": [số Ý Nhận biết], "h": [số Ý Thông hiểu], "vd": [số Ý Vận dụng/VDC] },
                "sa": { "b": [số câu Nhận biết], "h": [số câu Thông hiểu], "vd": [số câu Vận dụng/VDC] }
              }
            }
            Lưu ý: 
            - Phần Trắc nghiệm Đúng/Sai (tf): Tính theo số LƯỢNG Ý (mỗi câu có 4 ý a,b,c,d), hãy đếm tổng số ý và phân loại vào b, h, vd sao cho tổng ý chia hết cho 4.
            - Nếu không có phần Tự luận, bỏ qua 'essay' trong JSON.
        `;

        const result = await model.generateContent([prompt, filePart]);
        let textResult = result.response.text();
        
        // Làm sạch dữ liệu JSON phòng trường hợp AI trả về thừa markdown
        textResult = textResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const parsedData = JSON.parse(textResult);
        
        // Tự động điền dữ liệu vào State
        if (parsedData.testScope) setTestScope(parsedData.testScope);
        if (parsedData.matrix) {
            setMatrix(prev => ({
                ...prev,
                mcq: { ...prev.mcq, ...parsedData.matrix.mcq },
                tf: { ...prev.tf, ...parsedData.matrix.tf },
                sa: { ...prev.sa, ...parsedData.matrix.sa }
            }));
        }
        
        alert("✨ Đã bóc tách thành công! Cấu hình Ma trận đã được tự động cập nhật.");

    } catch (error) {
        console.error(error);
        alert("Lỗi bóc tách đề: " + error.message);
    } finally {
        setIsAnalyzing(false);
        // Reset input để có thể upload lại cùng 1 file nếu cần
        if(fileInputRef.current) fileInputRef.current.value = ""; 
    }
  };

  // --- HÀM TẠO ĐỀ CŨ (GIỮ NGUYÊN 100% CỦA BẠN) ---
  const handleGenerateTest = async () => {
    if (!testTitle.trim()) return alert("Vui lòng nhập Tiêu đề bài kiểm tra!");
    if (!testScope.trim()) return alert("Vui lòng nhập Phạm vi kiểm tra (VD: Từ bài 1 đến bài 4)!");
    
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

        const prompt = `
Bạn là một Chuyên gia Khảo thí giáo dục. Hãy tạo một Bộ Đề Kiểm Tra đầy đủ 4 phần chuẩn form cấu trúc 2025 của Bộ GD&ĐT.

**THÔNG TIN ĐỀ THI:**
- Môn: ${subject} - Lớp: ${grade}
- Tiêu đề: ${testTitle}
- Thời gian: ${duration} phút
- PHẠM VI KIẾN THỨC: """${testScope}"""

**CẤU TRÚC MA TRẬN YÊU CẦU:**
1. Phần I. Trắc nghiệm nhiều lựa chọn: Tổng ${getTotalQ_Normal('mcq')} câu (Biết: ${matrix.mcq.b}, Hiểu: ${matrix.mcq.h}, Vận dụng: ${matrix.mcq.vd}).
    - Câu hỏi không kiểu theo sách giáo khoa, theo bảng phân phối, hay theo thứ tự kiến thức. Hãy sáng tạo câu hỏi bám sát sách giáo khoa nhưng có tình huống thực tế, hoặc câu hỏi mở rộng để đánh giá đúng năng lực học sinh ở từng mức độ.
    - Không trả lời kiểu tất cả đều đúng, A và B đúng, v.v... Mỗi câu chỉ có duy nhất 1 đáp án đúng.
2. Phần II. Trắc nghiệm Đúng/Sai: Gồm tổng cộng ${totalTF_Q} câu. (Mỗi câu bắt buộc có 4 ý a, b, c, d). Phân bổ số ý: Biết ${matrix.tf.b} ý, Hiểu ${matrix.tf.h} ý, Vận dụng ${matrix.tf.vd} ý.
   - ĐIỀU KIỆN SỐNG CÒN 1: Bắt buộc TRỘN LẪN các mức độ nhận thức (Biết, Hiểu, Vận dụng) vào 4 ý của cùng một câu hỏi. (Ví dụ: Câu 1 có 2 ý Biết, 1 ý Hiểu, 1 ý Vận dụng). Tuyệt đối không đánh giá độ khó chung cho cả 1 câu.
   - ĐIỀU KIỆN SỐNG CÒN 2: Tổng số lượng các ý phân bổ toàn phần II phải khớp chính xác: Biết ${matrix.tf.b} ý, Hiểu ${matrix.tf.h} ý, Vận dụng ${matrix.tf.vd} ý.
   - LỜI DẪN LÀ MỘT TÌNH HUỐNG TRONG THỰC TẾ BÁM SÁT NỘI DUNG BÀI HỌC CÓ ĐỘ DÀI KHOẢNG 2-3 DÒNG.
3. Phần III. Trả lời ngắn: Tổng ${getTotalQ_Normal('sa')} câu (Biết: ${matrix.sa.b}, Hiểu: ${matrix.sa.h}, Vận dụng: ${matrix.sa.vd}).
4. Phần IV. Tự luận: Tổng ${getTotalQ_Normal('essay')} câu (Biết: ${matrix.essay.b}, Hiểu: ${matrix.essay.h}, Vận dụng: ${matrix.essay.vd}).

**QUY TẮC ĐỒNG BỘ MA TRẬN VÀ ĐẶC TẢ (SỐNG CÒN - NGHIÊM CẤM LÀM SAI):**
1. TUYỆT ĐỐI KHÔNG GỘP CHUNG VÀO 1 HÀNG: Phải phân tách "Phạm vi kiến thức" thành ít nhất 2 đến 4 "Chủ đề/Chương" (hàng) khác nhau. Hãy rải đều số lượng câu hỏi vào các hàng này.
2. ĐỒNG BỘ 100%: Nội dung của Cột "Chủ đề/Chương" và Cột "Nội dung/đơn vị kiến thức" ở BẢNG MA TRẬN (Phần 1) BẮT BUỘC PHẢI GIỐNG HỆT 100% với BẢNG ĐẶC TẢ (Phần 2). Không được sai lệch dù chỉ 1 chữ.

**QUY TẮC ĐỊNH DẠNG CÂU HỎI & ĐÁP ÁN (NGHIÊM CẤM LÀM SAI):**
- ĐÁP ÁN CÂU NHIỀU LỰA CHỌN: Bắt buộc thêm ký tự sao (*) viết liền trước đáp án đúng (VD: *A. hoặc *B. ).
- ĐÁP ÁN CÂU ĐÚNG/SAI: Ý nào có phát biểu ĐÚNG, bắt buộc phải thêm ký tự sao (*) viết liền trước chữ cái (VD: *a) hoặc *c) ).
- TIÊU ĐỀ CÂU ĐÚNG/SAI: Tuyệt đối KHÔNG ghi các từ (Biết), (Hiểu), (Vận dụng) cạnh tiêu đề Câu 1, Câu 2 của phần Đúng/Sai. Hãy để ngầm định.
- ÉP BUỘC XUỐNG DÒNG: Các phương án (A, B, C, D) và (a, b, c, d) PHẢI xuống dòng (Enter 2 lần).
- TRẢ LỜI NGẮN: Dưới mỗi câu hỏi Trả lời ngắn, ghi: "Key: [đáp án]".
- MÃ CODE LẬP TRÌNH (PYTHON/C++): BẮT BUỘC đặt các đoạn mã code lập trình vào trong cặp dấu 3 gạch ngược (\`\`\`python ... \`\`\`) để tạo thành một hộp code. TUYỆT ĐỐI KHÔNG được đặt code vào trong thẻ $...$ của toán học.
- TOÁN HỌC/LÝ/HÓA: Công thức BẮT BUỘC dùng LaTeX kẹp trong $...$. BẮT BUỘC gõ khoảng trắng (space) TRƯỚC và SAU mỗi công thức $...$. TUYỆT ĐỐI KHÔNG dùng dấu nháy đơn (' '), nháy kép (" ") hay backtick (\` \`) bao quanh công thức.
- BẮT ĐẦU VĂN BẢN TỪ "### **PHẦN 1: MA TRẬN ĐỀ KIỂM TRA**", TUYỆT ĐỐI KHÔNG CHÀO HỎI.
**QUY TẮC ĐÚNG THEO CÁC BÀI TRONG SÁCH GIÁO KHOA:**
- CHỦ ĐỀ/CHƯƠNG: Dựa trên mục lục sách giáo khoa, tách thành các chủ đề/chương khác nhau. Ví dụ: Toán 11 có thể tách thành "Hàm số & PT Lượng giác", "Dãy số, Cấp số cộng/nhân", "Tích phân", v.v...
- CÁC BÀI HỌC: Dựa trên từng bài học trong sách giáo khoa, tạo thành các đơn vị kiến thức cụ thể. Ví dụ: "Hàm số & PT Lượng giác" có thể tách thành "Hàm số bậc nhất", "Hàm số bậc hai", "Phương trình lượng giác cơ bản", v.v...
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
      <td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>${totalB_Score}</td><td>${totalH_Score}</td><td>${totalVD_Score}</td><td>${sumScores}</td>
    </tr>
    <tr style="font-weight:bold;">
      <td colspan="3">Tỉ lệ %</td>
      <td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>...%</td><td>${percentB}%</td><td>${percentH}%</td><td>${percentVD}%</td><td>100%</td>
    </tr>
  </tbody>
</table>

### **PHẦN 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA**
BẮT BUỘC copy y nguyên khối HTML dưới đây để tạo bảng Đặc tả. Thêm \`style="text-align: left;"\` vào \`<td>\` cột 2, 3, 4.
**QUY TẮC ĐIỀN DỮ LIỆU ĐẶC TẢ (CỰC KỲ QUAN TRỌNG VỀ LIÊN KẾT CÂU HỎI):**
1. Các hàng ở cột "Chủ đề/Chương" và "Nội dung" BẮT BUỘC phải copy y hệt như trên bảng Ma trận ở Phần 1.
2. Cột "Yêu cầu cần đạt", dùng thẻ <br> để chia rõ 3 mức độ: + Biết: [...] <br> + Hiểu: [...] <br> + Vận dụng: [...]
3. Cột điền Số câu hỏi: BẮT BUỘC ghi số lượng câu, KÈM THEO VỊ TRÍ CÂU HỎI TRONG ĐỀ THI (để trong ngoặc đơn) và Mã năng lực đặc thù bên dưới (dùng thẻ <br>).
   *Ví dụ mẫu:* 2 (câu 1, 2) <br> (NLa) hoặc 1 (câu 3) <br> (NT) hoặc 4 (ý a,b câu 1) <br> (TH).
   *LƯU Ý: Tên câu (câu 1, câu 2...) phải khớp chính xác với số thứ tự câu tương ứng sẽ được tạo ra ở Phần 3 (Đề kiểm tra). ${competencyGuidance}*

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
  </tbody>
</table>

### **PHẦN 3: ĐỀ KIỂM TRA**
(Ghi chính xác các dòng Tiêu đề sau, không được thiếu sót:)
**PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.** Thí sinh trả lời từ câu 1 đến câu ${getTotalQ_Normal('mcq')}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
(Nội dung các câu hỏi...)

**PHẦN II. Câu trắc nghiệm đúng sai.** Thí sinh trả lời từ câu 1 đến câu ${totalTF_Q}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.
**Câu 1:** Lời dẫn tình huống... (Tuyệt đối KHÔNG ghi chữ Biết, Hiểu, Vận dụng ở đây).
a) Nội dung ý...
b) Nội dung ý...
(Các câu khác tương tự)

**PHẦN III. Câu trắc nghiệm trả lời ngắn.** Thí sinh trả lời từ câu 1 đến câu ${getTotalQ_Normal('sa')}.
(Nội dung các câu hỏi... Nhớ thêm Key: đáp án)

### **PHẦN 4: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM**
1. Bảng đáp án Phần I và Phần II (Dùng bảng Markdown).
2. Bảng Hướng dẫn chấm Phần Tự luận / Trả lời ngắn: BẮT BUỘC DÙNG BẢNG MARKDOWN DƯỚI ĐÂY (Tuyệt đối không dùng bảng HTML).
| Câu | Nội dung đáp án / Code / Công thức | Điểm |
|:---:|---|:---:|
| 1 | Lời giải dòng 1 <br> Lời giải dòng 2 | 1.0 |
- LUẬT THÉP BẢO VỆ BẢNG ĐÁP ÁN MARKDOWN:
  + TRONG BẢNG NÀY TUYỆT ĐỐI KHÔNG SỬ DỤNG BA DẤU GẠCH NGƯỢC (\`\`\`) ĐỂ VIẾT CODE VÌ SẼ LÀM VỠ BẢNG.
  + Mọi nội dung, kể cả Code Python/C++ trong bảng này BẮT BUỘC phải dùng thẻ <br> để xuống dòng, viết liền mạch trên 1 hàng ngang của bảng.
        `;

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();

        const targetStart = "### **PHẦN 1";
        const startIndex = textResult.indexOf(targetStart);
        if (startIndex !== -1) {
            textResult = textResult.substring(startIndex);
        }

        textResult = textResult.replace(/```html\n?/g, '');
        textResult = textResult.replace(/```\n?/g, '');

        let splitParts = textResult.split("### **PHẦN 4:");
        let part123 = splitParts[0];
        let part4 = splitParts.length > 1 ? "\n### **PHẦN 4:" + splitParts[1] : "";

        part4 = part4.replace(/```[a-z]*\n?/gi, '<br> *[Code]* <br>'); 
        part4 = part4.replace(/```/g, '<br>');

        part123 = part123.replace(/a\),\s*b\),\s*c\),\s*d\)/g, '@@ABCD_LOWER@@');

        part123 = part123.replace(/([^\n])\s+(\*?[A-D]\.)/g, '$1\n\n$2');
        part123 = part123.replace(/([^\n])\s+(\*?[a-d]\))/g, '$1\n\n$2');
        part123 = part123.replace(/(\n)(\*?[A-D]\.)/g, '\n\n$2');
        part123 = part123.replace(/(\n)(\*?[a-d]\))/g, '\n\n$2');

        part123 = part123.replace(/@@ABCD_LOWER@@/g, 'a), b), c), d)');

        textResult = part123 + part4;

        textResult = textResult.replace(/\n\n\*([A-D]\.)/g, '\n\n\\*$1');
        textResult = textResult.replace(/\n\n\*([a-d]\))/g, '\n\n\\*$1');
        textResult = textResult.replace(/^\*([A-D]\.)/gm, '\\*$1');
        textResult = textResult.replace(/^\*([a-d]\))/gm, '\\*$1');

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
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
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

  return (
    <div className="min-h-screen bg-[#0f172a] font-sans flex flex-col h-screen overflow-hidden text-slate-200">
      
      <header className="h-[70px] bg-[#1e293b]/90 backdrop-blur border-b border-white/10 px-6 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-4">
             <button onClick={() => router.push('/dashboard')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition"><ArrowLeft size={20}/></button>
             <div>
                 <h1 className="text-xl font-black text-white uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">AI SOẠN ĐỀ FULL & TƯ DUY NGƯỢC</h1>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Tự động đọc PDF & Liên kết Số Câu Hỏi</p>
             </div>
         </div>
         {resultMarkdown && (
             <button onClick={exportToWord} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition">
                 <Download size={16}/> Tải Bản Word Ngang
             </button>
         )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          <div className="w-full lg:w-[460px] bg-[#020617] border-r border-white/10 overflow-y-auto p-4 custom-scrollbar shrink-0">
              
              <div className="space-y-4">
                  {/* --- KHU VỰC MỚI: UPLOAD FILE ĐỂ BÓC TÁCH --- */}
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-indigo-500/30 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <h3 className="text-xs font-black text-indigo-400 uppercase flex items-center gap-2 mb-2">
                          <FileSearch size={16}/> Phân Tích Ma Trận Từ File Gốc
                      </h3>
                      <p className="text-[10px] text-slate-400 mb-3">Tải lên đề thi (PDF) để AI tự động đếm số lượng câu hỏi và phân mức độ Nhận biết, Thông hiểu...</p>
                      
                      <div 
                          className="border-2 border-dashed border-slate-600 hover:border-indigo-400 bg-slate-900/50 rounded-lg p-4 text-center cursor-pointer transition relative"
                          onClick={() => !isAnalyzing && fileInputRef.current.click()}
                      >
                          <input 
                              type="file" 
                              accept=".pdf" 
                              className="hidden" 
                              ref={fileInputRef}
                              onChange={handleAnalyzeFile}
                              disabled={isAnalyzing || loading}
                          />
                          {isAnalyzing ? (
                              <div className="flex flex-col items-center justify-center text-indigo-400">
                                  <Loader2 className="animate-spin mb-2" size={24}/>
                                  <span className="text-xs font-bold uppercase">AI Đang bóc tách đề...</span>
                              </div>
                          ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400 hover:text-indigo-300">
                                  <UploadCloud size={24} className="mb-2"/>
                                  <span className="text-xs font-bold">Click để tải lên file PDF</span>
                              </div>
                          )}
                      </div>
                  </div>
                  {/* --- KẾT THÚC KHU VỰC MỚI --- */}

                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Khối lớp</label>
                          <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg outline-none focus:border-red-500 text-white font-bold text-sm">
                              {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Môn học</label>
                          <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg outline-none focus:border-red-500 text-white font-bold text-sm">
                              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                  </div>

                  <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Tiêu đề Bài kiểm tra</label>
                      <input value={testTitle} onChange={e=>setTestTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg outline-none focus:border-red-500 text-white font-bold text-sm" placeholder="VD: ĐỀ KIỂM TRA GIỮA KÌ 1"/>
                  </div>

                  <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Thời gian làm bài (Phút)</label>
                      <input type="number" min="15" value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg outline-none focus:border-red-500 text-white font-bold text-sm"/>
                  </div>

                  <div className={`p-3 rounded-lg border transition-all ${isAnalyzing ? 'bg-indigo-900/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-900/50 border-red-500/30'}`}>
                      <label className={`block text-[10px] font-black mb-1 uppercase ${isAnalyzing ? 'text-indigo-400' : 'text-red-400'}`}>Phạm vi kiến thức</label>
                      <textarea 
                          value={testScope} 
                          onChange={e=>setTestScope(e.target.value)} 
                          rows={3} 
                          className="w-full bg-[#020617] border border-red-900 p-2 rounded-md outline-none focus:border-red-500 text-slate-200 text-xs" 
                          placeholder="VD: Từ bài 21 đến bài 28..."
                      />
                  </div>

                  <div className={`p-3 rounded-xl border shadow-inner transition-all ${isAnalyzing ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-800/80 border-orange-500/30'}`}>
                      <div className="flex justify-between items-center mb-2">
                          <label className="block text-[10px] font-black text-orange-400 uppercase flex items-center gap-1"><LayoutTemplate size={14}/> Cấu hình Ma trận</label>
                          {totalTF_Y % 4 !== 0 && <div className="text-[9px] text-red-400 font-bold flex items-center gap-1 animate-pulse"><AlertCircle size={10}/> Lỗi ý Đ/S</div>}
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                  <tr className="border-b border-slate-600 text-slate-400">
                                      <th className="py-1">Loại CH</th>
                                      <th className="py-1 text-center" title="Biết">B</th>
                                      <th className="py-1 text-center" title="Hiểu">H</th>
                                      <th className="py-1 text-center" title="Vận dụng">VD</th>
                                      <th className="py-1 text-center text-cyan-400">Tổng</th>
                                      <th className="py-1 text-center">Điểm/Câu</th>
                                  </tr>
                              </thead>
                              <tbody className="text-white font-medium divide-y divide-slate-700/50">
                                  <tr>
                                      <td className="py-1.5 whitespace-nowrap text-[10px]">Trắc nghiệm</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.b} onChange={e=>handleMatrixChange('mcq', 'b', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.h} onChange={e=>handleMatrixChange('mcq', 'h', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.mcq.vd} onChange={e=>handleMatrixChange('mcq', 'vd', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1 text-center font-bold text-cyan-400">{getTotalQ_Normal('mcq')} c</td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.mcq.point} onChange={e=>handleMatrixChange('mcq', 'point', e.target.value)} className="w-10 md:w-12 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1 text-yellow-400"/></td>
                                  </tr>
                                  <tr>
                                      <td className="py-1.5 text-[10px] leading-tight">Đúng/Sai<br/><span className="text-[8px] text-orange-300 italic">(Nhập số Lệnh hỏi)</span></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.b} onChange={e=>handleMatrixChange('tf', 'b', e.target.value)} className={`w-7 md:w-8 bg-slate-900 border rounded text-center outline-none focus:border-orange-500 p-1 ${totalTF_Y % 4 !== 0 ? 'border-red-500' : 'border-slate-600'}`}/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.h} onChange={e=>handleMatrixChange('tf', 'h', e.target.value)} className={`w-7 md:w-8 bg-slate-900 border rounded text-center outline-none focus:border-orange-500 p-1 ${totalTF_Y % 4 !== 0 ? 'border-red-500' : 'border-slate-600'}`}/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.tf.vd} onChange={e=>handleMatrixChange('tf', 'vd', e.target.value)} className={`w-7 md:w-8 bg-slate-900 border rounded text-center outline-none focus:border-orange-500 p-1 ${totalTF_Y % 4 !== 0 ? 'border-red-500' : 'border-slate-600'}`}/></td>
                                      <td className="p-1 text-center font-bold text-cyan-400 leading-tight">
                                          {totalTF_Q} c<br/><span className="text-[8px] text-slate-400 font-normal">({totalTF_Y} ý)</span>
                                      </td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.tf.point} onChange={e=>handleMatrixChange('tf', 'point', e.target.value)} className="w-10 md:w-12 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1 text-yellow-400"/></td>
                                  </tr>
                                  <tr>
                                      <td className="py-1.5 whitespace-nowrap text-[10px]">Trả lời ngắn</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.b} onChange={e=>handleMatrixChange('sa', 'b', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.h} onChange={e=>handleMatrixChange('sa', 'h', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.sa.vd} onChange={e=>handleMatrixChange('sa', 'vd', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1 text-center font-bold text-cyan-400">{getTotalQ_Normal('sa')} c</td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.sa.point} onChange={e=>handleMatrixChange('sa', 'point', e.target.value)} className="w-10 md:w-12 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1 text-yellow-400"/></td>
                                  </tr>
                                  <tr>
                                      <td className="py-1.5 whitespace-nowrap text-[10px]">Tự luận</td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.b} onChange={e=>handleMatrixChange('essay', 'b', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.h} onChange={e=>handleMatrixChange('essay', 'h', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1"><input type="number" min="0" value={matrix.essay.vd} onChange={e=>handleMatrixChange('essay', 'vd', e.target.value)} className="w-7 md:w-8 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1"/></td>
                                      <td className="p-1 text-center font-bold text-cyan-400">{getTotalQ_Normal('essay')} c</td>
                                      <td className="p-1"><input type="number" step="0.1" value={matrix.essay.point} onChange={e=>handleMatrixChange('essay', 'point', e.target.value)} className="w-10 md:w-12 bg-slate-900 border border-slate-600 rounded text-center outline-none focus:border-orange-500 p-1 text-yellow-400"/></td>
                                  </tr>
                              </tbody>
                              <tfoot className="border-t-2 border-slate-500 bg-slate-950 font-bold text-slate-300">
                                  <tr>
                                      <td className="py-2 text-[9px] uppercase text-slate-400">Tổng Lệnh/ %</td>
                                      <td className="p-1 text-center border-l border-slate-700">
                                          <div className="text-white text-sm">{totalB_Items}</div>
                                          <div className="text-[10px] text-emerald-400">{percentB}%</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-slate-700">
                                          <div className="text-white text-sm">{totalH_Items}</div>
                                          <div className="text-[10px] text-blue-400">{percentH}%</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-slate-700">
                                          <div className="text-white text-sm">{totalVD_Items}</div>
                                          <div className="text-[10px] text-purple-400">{percentVD}%</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-slate-700">
                                          <div className="text-white text-sm font-black text-cyan-400">{sumQuestions}c</div>
                                      </td>
                                      <td className="p-1 text-center border-l border-slate-700">
                                          <div className={`text-sm ${sumScores === 10 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>{sumScores.toFixed(2)}đ</div>
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>

                  <button onClick={handleGenerateTest} disabled={loading || isAnalyzing} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white py-3 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                      {loading ? <Loader2 className="animate-spin"/> : <Sparkles size={20}/>} {loading ? 'ĐANG TẠO ĐỀ...' : 'KHAI HOẢ TẠO ĐỀ'}
                  </button>
              </div>
          </div>

          <div className="flex-1 bg-slate-300 overflow-y-auto relative p-4 md:p-8 custom-scrollbar">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <div className="relative mb-6">
                          <div className="absolute inset-0 bg-red-500 blur-xl opacity-30 animate-pulse"></div>
                          <BrainCircuit size={80} className="text-red-600 relative z-10 animate-bounce"/>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-widest text-slate-700 mb-2">AI Đang thực thi</h3>
                      <p className="text-sm font-bold">Anh/chị cứ ngồi chơi để thư ký xinh gái em làm...</p>
                  </div>
              ) : resultMarkdown ? (
                  <div 
                      className="bg-white p-8 md:p-14 rounded shadow-2xl max-w-[1200px] mx-auto min-h-full text-black" 
                      id="markdown-export-area"
                  >
                      <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt', marginBottom: '16pt' }}>
                          <h2 style={{ fontSize: '16pt', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', marginBottom: '4pt' }}>
                              {testTitle}
                          </h2>
                          <h5 style={{ fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', marginTop: 0, marginBottom: '24pt' }}>
                              Môn: {subject} {grade} - Thời gian: {duration} phút
                          </h5>
                      </div>

                      <div style={{ fontFamily: "'Times New Roman', serif" }}>
                          <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeRaw, rehypeKatex]} 
                              components={{
                                  h3: ({node, ...props}) => <h3 style={{fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '20pt', marginBottom: '8pt', color: '#b91c1c', borderBottom: '1px solid #b91c1c', paddingBottom: '4px'}} {...props}/>,
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
                                  pre: ({node, ...props}) => <pre style={{backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '10pt', borderRadius: '4pt', overflowX: 'auto', fontFamily: "'Courier New', Courier, monospace", fontSize: '11pt', margin: '8pt 0'}} {...props}/>,
                                  code: ({node, inline, ...props}) => inline ? <code style={{backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', fontFamily: "'Courier New', Courier, monospace", color: '#e11d48'}} {...props}/> : <code style={{fontFamily: "'Courier New', Courier, monospace"}} {...props}/>,
                              }}
                          >
                              {resultMarkdown}
                          </ReactMarkdown>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                      <FileText size={100} className="mb-4"/>
                      <p className="text-xl font-bold uppercase tracking-widest">Khu vực hiển thị Đề kiểm tra</p>
                  </div>
              )}
          </div>

      </div>
    </div>
  );
}