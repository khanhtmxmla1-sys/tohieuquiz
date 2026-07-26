async function testPracticeLibrary() {
    console.log("🧪 BẮT ĐẦU KIỂM TRA NHANH: PRACTICE LIBRARY (API)");

    const baseUrl = "https://api.thtohieu.com";
    console.log(`\n🔗 Server: ${baseUrl}`);

    try {
        // Test 1: Lấy danh sách Topics
        console.log("\n[1/2] Đang gọi API lấy danh sách Chủ Đề (/api/practice/topics)...");
        const topicsRes = await fetch(`${baseUrl}/api/practice/topics`);
        if (!topicsRes.ok) throw new Error(`Status ${topicsRes.status}`);

        const topicsData = await topicsRes.json();
        console.log("✅ Thành công lấy danh sách chủ đề:", topicsData);

        if (!topicsData.topics || topicsData.topics.length === 0) {
            console.warn("⚠️ Cảnh báo: Không tìm thấy hashtag nào trong DB.");
            return;
        }

        // Lấy đại 1 topic đầu tiên
        const randomTopic = topicsData.topics[0];

        // Test 2: Tạo quiz ảo cho topic
        console.log(`\n[2/2] Đang gọi API tạo Quiz ảo cho chủ đề "${randomTopic}"...`);
        const encodedTopic = encodeURIComponent(randomTopic);
        const quizRes = await fetch(`${baseUrl}/api/practice?topic=${encodedTopic}&limit=3`);
        if (!quizRes.ok) throw new Error(`Status ${quizRes.status}`);

        const quizData = await quizRes.json();

        // Validate the quiz shape
        let isValid = true;
        if (quizData.isPractice !== true) {
            console.error("❌ Lỗi: isPractice flag không bằng true.");
            isValid = false;
        }
        if (quizData.timeLimit !== 0) {
            console.error(`❌ Lỗi: timeLimit = ${quizData.timeLimit} (Cần phải là 0).`);
            isValid = false;
        }
        if (!Array.isArray(quizData.questions)) {
            console.error("❌ Lỗi: Không tìm thấy mảng 'questions'.");
            isValid = false;
        }

        if (isValid) {
            console.log(`✅ Thành công! Đã tải về bài Quiz ảo với ${quizData.questions.length} câu hỏi.`);
            console.log(`   🔸 Tiêu đề: ${quizData.title}`);
            console.log(`   🔸 isPractice: ${quizData.isPractice}`);
            console.log(`   🔸 timeLimit: ${quizData.timeLimit}`);

            console.log("\n🎉 TEST ĐẠT (PASS)! Backend API đã trả dữ liệu và cờ nhận diện (flag) hoàn toàn chính xác.");
        }

    } catch (error: any) {
        console.error("\n❌ LỖI TRONG QUÁ TRÌNH TEST:");
        console.error(error.message);
    }
}

testPracticeLibrary();
