// File: src/utils/geminiInitiative.js

/**
 * Hàm core để gọi Google Gemini REST API
 */
async function callGeminiAPI(systemInstruction, userPrompt, apiKey, model = 'gemini-1.5-pro') {
    if (!apiKey) throw new Error("Chưa cấu hình Gemini API Key!");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 }
    };
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Lỗi gọi Gemini API");
    }
    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;

    // --- BỘ LỌC LÀM SẠCH VĂN BẢN (GỌT RÂU RIA CỦA AI) ---
    // 1. Xóa các thẻ bọc code markdown (```html, ```)
    text = text.replace(/```html/gi, '').replace(/```/gi, '');
    
    // 2. Xóa các dòng dẫn chuyện thừa thãi ở đầu văn bản (Dưới đây là, Đây là, Sau đây...)
    text = text.replace(/^(Dưới đây là|Đây là|Sau đây là|Để hoàn thiện).*?(:\s*|\n+)/gim, '');
    
    return text.trim();
}

/**
 * 1. Hàm Thẩm định Tính mới
 */
export async function checkNovelty(title, context, apiKey, model) {
    const systemPrompt = `Bạn là Giám khảo Hội đồng Sáng kiến. Phân tích Tính mới của đề tài dựa trên Tiêu chí I - QĐ 559/QĐ-HĐSK.
    TUYỆT ĐỐI KHÔNG sử dụng lời dẫn chuyện (như "Dưới đây là..."). Bắt đầu ngay bằng nội dung đánh giá.`;
    const userPrompt = `Tên đề tài dự kiến: ${title}\nĐặc thù/Bối cảnh: ${context}\nHãy đánh giá ngắn gọn tính mới và gợi ý tên đề tài. Trả về HTML (dùng <strong>, <ul>, <li>).`;
    return await callGeminiAPI(systemPrompt, userPrompt, apiKey, model);
}

/**
 * 2. Hàm Viết Nội dung chi tiết cho từng Giải pháp
 */
export async function generateMeasureContent(initiativeData, activeMeasureIndex, apiKey, model) {
    const measure = initiativeData.measures[activeMeasureIndex];
    const measureNum = activeMeasureIndex + 1; 
    const systemPrompt = `Bạn là một chuyên gia giáo dục học.
    TUÂN THỦ CÁC QUY TẮC SAU:
    1. Viết bằng ngôn ngữ học thuật, khoa học, khách quan.
    2. Đi sâu giải thích cặn kẽ cách thức tổ chức thực hiện, các bước tiến hành.
    3. Định dạng BẮT BUỘC trả về HTML sạch. Không dùng markdown.
    4. TUYỆT ĐỐI KHÔNG viết câu dẫn chuyện như "Dưới đây là phần nội dung...". Hãy xuất ra trực tiếp thẻ HTML đầu tiên.`;

    const userPrompt = `
    Tên đề tài: ${initiativeData.title}
    Bối cảnh: ${initiativeData.context}
    
    Nhiệm vụ: Viết TRỌN VẸN VÀ CHI TIẾT phần nội dung cho Giải pháp số ${measureNum}.
    - Tên giải pháp: ${measure.title}
    - Các thao tác cốt lõi tác giả đã làm: ${measure.promptInputs}

    YÊU CẦU CẤU TRÚC: BẮT BUỘC dùng thẻ <h5> có đánh số chính xác như sau:
    <h5>2.3.${measureNum}.1. Mục đích của giải pháp</h5>
    (Viết nội dung mục đích)
    
    <h5>2.3.${measureNum}.2. Cách thức tiến hành</h5>
    (Diễn giải chi tiết cách làm. Ở những vị trí mô tả giao diện, phần mềm hoặc thao tác thực tế cần hình ảnh trực quan, BẮT BUỘC chèn đoạn mã này: <br/><br/><div style="text-align: center;"><span style="color: red; font-weight: bold;">[Bổ sung ảnh minh hoạ]</span></div><br/>)
    
    <h5>2.3.${measureNum}.3. Ví dụ minh họa thực tiễn</h5>
    (Viết ví dụ cụ thể)`;

    return await callGeminiAPI(systemPrompt, userPrompt, apiKey, model);
}

/**
 * 3. Hàm Viết Kết quả và Sinh Mẫu 03 (Kết luận)
 */
export async function generateConclusionAndReport(initiativeData, apiKey, model) {
    const systemPrompt = `Bạn là chuyên gia viết Báo cáo SKKN. Viết phần Kết quả và Kết luận bằng định dạng HTML.
    BẮT BUỘC DÙNG CÁC THẺ HEADING NÀY VÀ TUYỆT ĐỐI KHÔNG CÓ LỜI MỞ ĐẦU HOẶC DẪN CHUYỆN:
    <h3>2.4. Kết quả đạt được</h3>
    <h2>3. KẾT LUẬN VÀ KIẾN NGHỊ</h2>
    <h3>3.1. Kết luận</h3>
    <h3>3.2. Kiến nghị</h3>`;
    const measuresSummary = initiativeData.measures.map(m => `- ${m.title}: ${m.promptInputs}`).join('\n');
    const userPrompt = `Tên đề tài: ${initiativeData.title}\nCác giải pháp đã triển khai:\n${measuresSummary}\nHãy viết chi tiết phần 2.4 và phần 3.`;
    return await callGeminiAPI(systemPrompt, userPrompt, apiKey, model);
}

/**
 * 4. Hàm Gợi ý Ý tưởng Thô (Bí kíp cho từng giải pháp)
 */
export async function suggestMeasureIdeas(initiativeData, activeMeasureIndex, apiKey, model) {
    const measure = initiativeData.measures[activeMeasureIndex];
    const systemPrompt = `Gợi ý 3 đến 5 gạch đầu dòng ngắn gọn về cách thực hiện giải pháp. Không có lời mở đầu hay kết luận.`;
    const userPrompt = `Đề tài: ${initiativeData.title}\nBối cảnh: ${initiativeData.context}\nTên giải pháp: ${measure.title}\nGợi ý các thao tác thực tế.`;
    return await callGeminiAPI(systemPrompt, userPrompt, apiKey, model);
}

/**
 * 5. Hàm Viết Phần Mở Đầu và Cơ sở lý luận (Tự động hoàn thiện)
 */
export async function generateIntroContent(initiativeData, apiKey, model) {
    const systemPrompt = `Viết phần MỞ ĐẦU và CƠ SỞ LÝ LUẬN, THỰC TRẠNG cho đề tài. Định dạng HTML.
    TUYỆT ĐỐI KHÔNG có câu dẫn chuyện (như "Dưới đây là..."). Bắt đầu ngay bằng thẻ <h2>1. MỞ ĐẦU</h2>`;
    const userPrompt = `Tên đề tài: ${initiativeData.title}\nBối cảnh/Thực trạng: ${initiativeData.context}
    Viết nội dung chi tiết cho:
    <h2>1. MỞ ĐẦU</h2>
    <h3>1.1. Lý do chọn đề tài</h3>
    <h3>1.2. Mục đích nghiên cứu</h3>
    <h3>1.3. Đối tượng nghiên cứu</h3>
    <h3>1.4. Phương pháp nghiên cứu</h3>
    <h3>1.5. Giới hạn phạm vi nghiên cứu</h3>
    <h2>2. NỘI DUNG</h2>
    <h3>2.1. Cơ sở lý luận của vấn đề</h3>
    <h3>2.2. Thực trạng của vấn đề</h3>`;
    return await callGeminiAPI(systemPrompt, userPrompt, apiKey, model);
}

/**
 * 6. Hàm Gợi ý danh sách Các Giải Pháp (Nút AI ở Bước 2)
 */
export async function suggestMeasuresList(title, context, apiKey, model) {
    const systemPrompt = `Bạn là giám khảo chấm Sáng kiến kinh nghiệm.
    Nhiệm vụ: Đề xuất 3 đến 5 "Tên giải pháp" đột phá và thực tiễn để cấu trúc bài SKKN.
    CHỈ TRẢ VỀ DANH SÁCH, mỗi giải pháp 1 dòng, bắt đầu bằng dấu gạch ngang (-). Không giải thích, không dẫn chuyện.`;
    const userPrompt = `Tên đề tài: ${title}\nBối cảnh/Thực trạng: ${context}\nHãy gợi ý danh sách các giải pháp.`;
    return await callGeminiAPI(systemPrompt, userPrompt, apiKey, model);
}