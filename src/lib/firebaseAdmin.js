import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        // Xử lý Private Key linh hoạt cho cả Local và Vercel
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey) {
            // Thay thế ký tự \n dạng chuỗi thành xuống dòng thực tế
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
        console.log("Firebase Admin Initialized Successfully");
    } catch (error) {
        console.error('Lỗi khởi tạo Firebase Admin:', error.stack);
    }
}

const adminAuth = admin.auth();
const adminFirestore = admin.firestore();

export { adminAuth, adminFirestore };