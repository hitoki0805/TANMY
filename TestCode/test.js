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

        // その日の予定を取得
        const dayUnavailableTimes = unavailableTimes.filter(time => {
            const timeDate = new Date(time.date);
            return timeDate.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0];
        });

        // 予定がない時間帯を見つける
        let lastEndTime = dayStart;
        for (const time of dayUnavailableTimes) {
            const startTime = new Date(time.date + 'T' + time.startTime);
            const endTime = new Date(time.date + 'T' + time.endTime);

            if (startTime > lastEndTime) {
                availableSlots.push({ start: lastEndTime, end: startTime });
            }
            if (endTime.getDate() !== startTime.getDate()) {
                const endOfDay = new Date(startTime);
                endOfDay.setHours(24, 0, 0, 0);
                if (startTime > lastEndTime) {
                    availableSlots.push({ start: lastEndTime, end: startTime });
                }
                lastEndTime = endTime;
            } else {
                lastEndTime = endTime > lastEndTime ? endTime : lastEndTime; // 更新
            }
        }

        if (lastEndTime < dayEnd) {
            availableSlots.push({ start: lastEndTime, end: dayEnd });
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 店舗が開店している時間帯のみをフィルタリング
    return availableSlots.filter(slot => {
        const slotStartHour = slot.start.getHours();
        const slotEndHour = slot.end.getHours();
        return (slotStartHour >= storeOpenTime || slotStartHour < storeCloseTime) &&
               (slotEndHour > storeOpenTime || slotEndHour <= storeCloseTime);
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
        const shift = { start: startTime, end: endTime, wage: wage };
        shiftCandidates.push(shift);
    }
    return shiftCandidates;
}

// 配列をシャッフルする関数（Fisher-Yatesアルゴリズム）
function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}

// 目標金額を達成するシフトを選定
/*function selectOptimalShifts(shiftCandidates, targetEarnings) {
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
}*/

// 目標金額を達成するシフトを選定
function selectOptimalShifts(shiftCandidates, targetEarnings, randomize = false) {
    let totalEarnings = 0;
    const selectedShifts = [];

    if (randomize) {
        shiftCandidates = shuffle(shiftCandidates);
    }

    for (const shift of shiftCandidates) {
        if (totalEarnings >= targetEarnings) break;
        const shiftDuration = (shift.end - shift.start) / (1000 * 60 * 60); // 時間単位
        const shiftEarnings = shiftDuration * shift.wage;
        totalEarnings += shiftEarnings;
        selectedShifts.push(shift);
    }

    // 選ばれたシフトを日付順にソート
    selectedShifts.sort((a, b) => a.start - b.start);
    
    return { selectedShifts, totalEarnings };
}


async function getAllUnavailableTimes(startDate, endDate, sleepStartTime, sleepEndTime) {
    const unavailableTimes = await getUnavailableTimes();
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const currentDateStr = currentDate.toISOString().split('T')[0];
        const nextDateStr = new Date(currentDate.getTime() + 86400000).toISOString().split('T')[0];

        if (sleepStartTime > sleepEndTime) {
            unavailableTimes.push(
                { date: currentDateStr, startTime: `${sleepStartTime}:00`, endTime: '24:00' },
                { date: nextDateStr, startTime: '00:00', endTime: `${sleepEndTime}:00` }
            );
        } else {
            unavailableTimes.push(
                { date: currentDateStr, startTime: `${sleepStartTime}:00`, endTime: `${sleepEndTime}:00` }
            );
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 時系列順に並べ替え
    unavailableTimes.sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.startTime);
        const dateB = new Date(b.date + 'T' + b.startTime);
        return dateA - dateB;
    });

    return unavailableTimes;
}

// メイン関数
/*async function proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime, sleepStartTime, sleepEndTime) {
    const unavailableTimes = await getAllUnavailableTimes(startDate, endDate, sleepStartTime, sleepEndTime);
    // デバッグ用に登録されている予定をコンソールに出力
    console.log("登録されている予定:", unavailableTimes);

    const availableSlots = findAvailableSlots(unavailableTimes, startDate, endDate, storeOpenTime, storeCloseTime);

    console.log("空いている時間:", availableSlots)
    const shiftCandidates = generateShiftCandidates(availableSlots, hourlyWage, nightWage, holidayPay);
    // デバッグ用にシフト候補をコンソールに出力
    console.log("シフト候補一覧:", shiftCandidates);

    const { selectedShifts, totalEarnings } = selectOptimalShifts(shiftCandidates, targetEarnings);
    return { selectedShifts, totalEarnings };
}*/

async function proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime, sleepStartTime, sleepEndTime, randomize = false) {
    const unavailableTimes = await getAllUnavailableTimes(startDate, endDate, sleepStartTime, sleepEndTime);
    console.log("登録されている予定:", unavailableTimes);

    const availableSlots = findAvailableSlots(unavailableTimes, startDate, endDate, storeOpenTime, storeCloseTime);
    console.log("空いている時間:", availableSlots);

    const shiftCandidates = generateShiftCandidates(availableSlots, hourlyWage, nightWage, holidayPay);
    console.log("シフト候補一覧:", shiftCandidates);

    const { selectedShifts, totalEarnings } = selectOptimalShifts(shiftCandidates, targetEarnings, randomize);
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
    const storeOpenTime = 8;     // 店舗の開店時間 (8時)
    const storeCloseTime = 2;    // 店舗の閉店時間 (翌2時)
    const sleepStartTime = 23;   // 睡眠開始時刻
    const sleepEndTime = 7;      // 睡眠終了時刻

    /*proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime, sleepStartTime, sleepEndTime)
    .then(({ selectedShifts, totalEarnings }) => {
        console.log("提案されたシフト:", selectedShifts);
        console.log("合計の稼ぎ:", totalEarnings);
    })
    .catch(error => {
        console.error("エラーが発生しました:", error);
    });

    console.log("テスト終了");*/
    proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime, sleepStartTime, sleepEndTime, false)
    .then(({ selectedShifts, totalEarnings }) => {
        console.log("提案されたシフト（順番通り）:", selectedShifts);
        console.log("合計の稼ぎ（順番通り）:", totalEarnings);
    })
    .catch(error => {
        console.error("エラーが発生しました:", error);
    });

    // ランダムなシフト提案をテスト
    proposeShifts(targetEarnings, hourlyWage, nightWage, holidayPay, startDate, endDate, storeOpenTime, storeCloseTime, sleepStartTime, sleepEndTime, true)
    .then(({ selectedShifts, totalEarnings }) => {
        console.log("提案されたシフト（ランダム）:", selectedShifts);
        console.log("合計の稼ぎ（ランダム）:", totalEarnings);
    })
    .catch(error => {
        console.error("エラーが発生しました:", error);
    });

    console.log("テスト終了");
}

// ページ読み込み時にテストを実行
window.onload = runTests;