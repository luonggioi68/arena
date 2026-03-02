// pages/api/fetch-doc.js
export default async function handler(req, res) {
    // Chỉ chấp nhận request POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url || !url.includes('docs.google.com')) {
        return res.status(400).json({ error: 'Link Google Doc không hợp lệ!' });
    }

    try {
        // Dùng Regex để tách lấy ID của file Google Doc từ link
        const match = url.match(/\/d\/(.*?)(\/|$)/);
        if (!match || !match[1]) {
            return res.status(400).json({ error: 'Không tìm thấy ID của tài liệu trong đường link.' });
        }
        
        const docId = match[1];
        
        // Tạo link ép Google trả về định dạng Text thuần (TXT)
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

        // Gọi fetch nội dung text
        const response = await fetch(exportUrl);
        
        if (!response.ok) {
            throw new Error('Không thể đọc file. Vui lòng đảm bảo Google Doc đã được cấp quyền "Bất kỳ ai có đường liên kết" (Share Public).');
        }

        const textContent = await response.text();
        
        // Trả text về cho Frontend
        res.status(200).json({ text: textContent });
    } catch (error) {
        console.error("Lỗi fetch doc:", error);
        res.status(500).json({ error: error.message });
    }
}