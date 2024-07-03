/*
JavaScript関数のテスト用コード
1．テストしたい関数を作成
2．テストコードを作成
3．ページ読み込み時にテストコードを実行するように設定
4．test.htmlで読み込む
*/

// モックデータを返す関数
async function getUnavailableTimes() {
    return [
        { date: '2024-06-01', startTime: '09:00', endTime: '12:00' },
        { date: '2024-06-05', startTime: '09:00', endTime: '12:00' },
        { date: '2024-06-10', startTime: '14:00', endTime: '16:00' },
        { date: '2024-06-15', startTime: '18:00', endTime: '20:00' },
        // 他のモックデータを追加
    ];
}

// 予定のない時間帯を見つける
function findAvailableSlots(unavailableTimes, startDate, endDate, storeOpenTime, storeCloseTime) {
    const availableSlots = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        let dayStart = new Date(currentDate);
        let dayEnd = new Date(currentDate);

        dayStart.setHours(storeOpenTime, 0, 0, 0);
        if (storeCloseTime <= storeOpenTime) {
            dayEnd.setDate(dayEnd.getDate() + 1);
        }
        dayEnd.setHours(storeCloseTime, 0, 0, 0);

        availableSlots.push({ start: dayStart, end: dayEnd });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots.filter(slot => {
        return !unavailableTimes.some(time => {
            const startTime = new Date(time.date + 'T' + time.startTime);
            const endTime = new Date(time.date + 'T' + time.endTime);
            return (startTime < slot.end && endTime > slot.start);
        });
    });
}

// シフトの候補を生成
function generateShiftCandidates(availableSlots, hourlyWage, nightWage, holidayPay) {
    const shiftCandidates = [];
    const maxHoursPerDay = 8; // 一日あたりの最大労働時間

    for (const slot of availableSlots) {
        let startTime = new Date(slot.start);
        let endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + maxHoursPerDay);

        if (endTime > slot.end) {
            endTime = new Date(slot.end);
        }

        const isNight = startTime.getHours() >= 22 || endTime.getHours() <= 5;
        const isHoliday = startTime.getDay() === 0 || startTime.getDay() === 6;
        const wage = isNight ? nightWage : (isHoliday ? holidayPay : hourlyWage);
        shiftCandidates.push({ start: startTime, end: endTime, wage: wage });
    }
    return shiftCandidates;
}

// 目標金額を達成するシフトを選定
function selectOptimalShifts(shiftCandidates, targetEarnings) {
    let totalEarnings = 0;
    const selectedShifts = [];

    for (const shift of shiftCandidates) {
        if (totalEarnings >= targetEarnings) break;
        const shiftDuration = (shift.end - shift.start) / (1000 * 60 * 60); // 時間単位
        const shiftEarnings = shiftDuration * shift.wage;
        totalEarnings += shiftEarnings;
        selectedShifts.push(shift);
    }

    return { selectedShifts, totalEarnings };
}

// メイン関数
async function proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime) {
    const unavailableTimes = await getUnavailableTimes();
    const availableSlots = findAvailableSlots(unavailableTimes, startDate, endDate, storeOpenTime, storeCloseTime);
    const shiftCandidates = generateShiftCandidates(availableSlots, hourlyWage, nightWage, holidayPay);
    const { selectedShifts, totalEarnings } = selectOptimalShifts(shiftCandidates, targetEarnings);
    return { selectedShifts, totalEarnings };
}

// テストコード
function runTests() {
    console.log("テスト開始");

    const targetEarnings = 50000;     // 一ヶ月に稼ぎたい金額
    const hourlyWage = 1000;      // 時給(通常時)
    const nightWage = 1200;       // 深夜給
    const holidayPay = 1500;      // 休日給
    const startDate = new Date('2024-06-01');      // シフト提案の開始日
    const endDate = new Date('2024-06-30');        // シフト提案の終了日
    const storeOpenTime = 5;     // 店舗の開店時間 (10時)
    const storeCloseTime = 2;    // 店舗の閉店時間 (翌2時)

    proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime)
    .then(({ selectedShifts, totalEarnings }) => {
        console.log("提案されたシフト:", selectedShifts);
        console.log("合計の稼ぎ:", totalEarnings);
    })
    .catch(error => {
        console.error("エラーが発生しました:", error);
    });

    console.log("テスト終了");
}

// ページ読み込み時にテストを実行
window.onload = runTests;