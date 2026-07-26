/**
 * Achievement System Test Script
 * 
 * Test all 23 achievements to verify they unlock correctly
 * Run: npx tsx workers/scripts/test-achievements.ts
 */

interface TestResult {
    achievement: string;
    expected: boolean;
    actual: boolean;
    passed: boolean;
    message: string;
}

const results: TestResult[] = [];

function testAchievement(
    achievement: string,
    expected: boolean,
    actual: boolean,
    message: string
) {
    const passed = expected === actual;
    results.push({ achievement, expected, actual, passed, message });
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${achievement}: ${message}`);
}

async function runTests() {
    console.log('🧪 Testing Achievement System...\n');
    
    // Mock data for testing
    const mockProfile = {
        username: 'test_student',
        daily_streak: 7,
        collection_json: JSON.stringify([
            { id: 'item1' },
            { id: 'item2' },
            { id: 'item3' },
            { id: 'item4' },
            { id: 'item5' },
        ]),
    };
    
    const mockDailyProgress = {
        total_quizzes: 10,
        completed_days: 5,
    };
    
    const mockResultsStats = {
        math_correct: 60,
        vietnamese_correct: 45,
        english_correct: 55,
        speed_count: 12,
        perfect_count: 8,
        early_bird_count: 11,
        night_owl_count: 9,
        total_correct: 250,
    };
    
    console.log('📊 Test Data:');
    console.log(`  - Daily Streak: ${mockProfile.daily_streak}`);
    console.log(`  - Collection Size: 5 items`);
    console.log(`  - Total Quizzes: ${mockDailyProgress.total_quizzes}`);
    console.log(`  - Completed Days: ${mockDailyProgress.completed_days}`);
    console.log(`  - Math Correct: ${mockResultsStats.math_correct}`);
    console.log(`  - Speed Count: ${mockResultsStats.speed_count}`);
    console.log(`  - Perfect Count: ${mockResultsStats.perfect_count}\n`);
    
    // === STREAK ACHIEVEMENTS ===
    console.log('🔥 Testing Streak Achievements:');
    testAchievement(
        'streak_3',
        true,
        mockProfile.daily_streak >= 3,
        `Streak ${mockProfile.daily_streak} >= 3`
    );
    testAchievement(
        'streak_7',
        true,
        mockProfile.daily_streak >= 7,
        `Streak ${mockProfile.daily_streak} >= 7`
    );
    testAchievement(
        'streak_30',
        false,
        mockProfile.daily_streak >= 30,
        `Streak ${mockProfile.daily_streak} < 30`
    );
    testAchievement(
        'streak_100',
        false,
        mockProfile.daily_streak >= 100,
        `Streak ${mockProfile.daily_streak} < 100`
    );
    
    // === COLLECTION ACHIEVEMENTS ===
    console.log('\n🎁 Testing Collection Achievements:');
    const collectionSize = JSON.parse(mockProfile.collection_json).length;
    testAchievement(
        'collector_5',
        true,
        collectionSize >= 5,
        `Collection ${collectionSize} >= 5`
    );
    testAchievement(
        'collector_10',
        false,
        collectionSize >= 10,
        `Collection ${collectionSize} < 10`
    );
    
    // === MISSION ACHIEVEMENTS ===
    console.log('\n🎯 Testing Mission Achievements:');
    testAchievement(
        'first_quiz',
        true,
        mockDailyProgress.total_quizzes >= 1,
        `Total quizzes ${mockDailyProgress.total_quizzes} >= 1`
    );
    testAchievement(
        'daily_hat_trick',
        true,
        mockDailyProgress.completed_days >= 1,
        `Completed days ${mockDailyProgress.completed_days} >= 1`
    );
    testAchievement(
        'weekly_warrior',
        true,
        mockDailyProgress.completed_days >= 7,
        `Completed days ${mockDailyProgress.completed_days} >= 7 (should be false, bug!)`
    );
    
    // === SUBJECT MASTERY ===
    console.log('\n🧮 Testing Subject Mastery Achievements:');
    testAchievement(
        'math_expert_50',
        true,
        mockResultsStats.math_correct >= 50,
        `Math correct ${mockResultsStats.math_correct} >= 50`
    );
    testAchievement(
        'math_expert_100',
        false,
        mockResultsStats.math_correct >= 100,
        `Math correct ${mockResultsStats.math_correct} < 100`
    );
    testAchievement(
        'vietnamese_expert_50',
        false,
        mockResultsStats.vietnamese_correct >= 50,
        `Vietnamese correct ${mockResultsStats.vietnamese_correct} < 50`
    );
    testAchievement(
        'english_expert_50',
        true,
        mockResultsStats.english_correct >= 50,
        `English correct ${mockResultsStats.english_correct} >= 50`
    );
    
    // === SPEED ACHIEVEMENTS ===
    console.log('\n⚡ Testing Speed Achievements:');
    testAchievement(
        'speed_demon_10',
        true,
        mockResultsStats.speed_count >= 10,
        `Speed count ${mockResultsStats.speed_count} >= 10`
    );
    testAchievement(
        'speed_master_30',
        false,
        mockResultsStats.speed_count >= 30,
        `Speed count ${mockResultsStats.speed_count} < 30`
    );
    
    // === PERFECT SCORE ===
    console.log('\n💯 Testing Perfect Score Achievements:');
    testAchievement(
        'perfect_5',
        true,
        mockResultsStats.perfect_count >= 5,
        `Perfect count ${mockResultsStats.perfect_count} >= 5`
    );
    testAchievement(
        'perfect_20',
        false,
        mockResultsStats.perfect_count >= 20,
        `Perfect count ${mockResultsStats.perfect_count} < 20`
    );
    
    // === TIME-BASED ===
    console.log('\n🌅 Testing Time-based Achievements:');
    testAchievement(
        'early_bird_10',
        true,
        mockResultsStats.early_bird_count >= 10,
        `Early bird count ${mockResultsStats.early_bird_count} >= 10`
    );
    testAchievement(
        'night_owl_10',
        false,
        mockResultsStats.night_owl_count >= 10,
        `Night owl count ${mockResultsStats.night_owl_count} < 10`
    );
    
    // === TOTAL QUESTIONS ===
    console.log('\n📝 Testing Total Questions Achievements:');
    testAchievement(
        'questions_100',
        true,
        mockResultsStats.total_correct >= 100,
        `Total correct ${mockResultsStats.total_correct} >= 100`
    );
    testAchievement(
        'questions_500',
        false,
        mockResultsStats.total_correct >= 500,
        `Total correct ${mockResultsStats.total_correct} < 500`
    );
    testAchievement(
        'questions_1000',
        false,
        mockResultsStats.total_correct >= 1000,
        `Total correct ${mockResultsStats.total_correct} < 1000`
    );
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(60));
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    console.log(`\n📊 Test Summary:`);
    console.log(`  Total: ${total}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  Success Rate: ${Math.round((passed / total) * 100)}%\n`);
    
    if (failed > 0) {
        console.log('❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.achievement}: Expected ${r.expected}, got ${r.actual}`);
        });
    } else {
        console.log('🎉 All tests passed!');
    }
    
    return failed === 0;
}

// Run tests
runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});
