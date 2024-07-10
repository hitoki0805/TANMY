/*
JavaScript関数のテスト用コード
1．テストしたい関数を作成
2．テストコードを作成
3．ページ読み込み時にテストコードを実行するように設定
4．test.htmlで読み込む
*/

// モックデータを追加する関数
async function getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate) {
    // 開始日と終了日の間の日付を生成
    const dateRange = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        dateRange.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const sleepTimes = dateRange.map(date => {
        if (sleepStartTime > sleepEndTime) { // 日付を跨ぐ場合
            return [
                { date: date, startTime: sleepStartTime, endTime: '24:00' },
                { date: new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0], startTime: '00:00', endTime: sleepEndTime }
            ];
        } else {
            return { date: date, startTime: sleepStartTime, endTime: sleepEndTime };
        }
    }).flat();

    const allTimes = [
        { date: '2024-06-01', startTime: '09:00', endTime: '12:00' },
        { date: '2024-06-05', startTime: '09:00', endTime: '12:00' },
        { date: '2024-06-10', startTime: '14:00', endTime: '16:00' },
        { date: '2024-06-15', startTime: '18:00', endTime: '20:00' },
        // 他のモックデータを追加
        ...sleepTimes
    ];

    // 日時でソート
    return allTimes.sort((a, b) => {
        let dateTimeA = new Date(`${a.date}T${a.startTime}`);
        let dateTimeB = new Date(`${b.date}T${b.startTime}`);
        return dateTimeA - dateTimeB;
    });
}

// メイン関数
async function proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime) {
    const blockedTimes = await getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate);
    console.log("登録されている予定", blockedTimes);

    // 利用可能なシフトを提案
    let availableShifts = [];
    let currentDate = new Date(`${startDate.toISOString().split('T')[0]}T${storeOpenTime}`);
    if (currentDate < startDate) {
        currentDate.setDate(currentDate.getDate() + 1); // 開店時間が指定された開始日より前なら、日付を1日進める
    }

    while (currentDate <= endDate) {
        let dayOpenTime = new Date(`${currentDate.toISOString().split('T')[0]}T${storeOpenTime}`);
        let dayCloseTime = new Date(`${currentDate.toISOString().split('T')[0]}T${storeCloseTime}`);
        let dayShifts = [];
        let totalHours = 0; // その日の合計労働時間を追跡

        console.log(dayOpenTime)

        // 当日の予定されている時間を除外
        const dayBlockedTimes = blockedTimes.filter(time => time.date === currentDate.toISOString().split('T')[0]);
        let currentTime = dayOpenTime; // 店舗の開店時間から開始
        dayBlockedTimes.forEach(block => {
            let blockStart = new Date(`${block.date}T${block.startTime}`);
            let blockEnd = new Date(`${block.date}T${block.endTime}`);
            if (currentTime < blockStart) {
                let shiftDuration = (blockStart - currentTime) / 3600000; // 時間単位で変換
                if (totalHours + shiftDuration > 8) {
                    shiftDuration = 8 - totalHours; // 8時間を超えないように調整
                    blockStart = new Date(currentTime.getTime() + shiftDuration * 3600000);
                }
                if (shiftDuration > 0) {
                    dayShifts.push({ start: currentTime, end: blockStart });
                    totalHours += shiftDuration;
                }
            }
            currentTime = new Date(Math.max(blockEnd.getTime(), dayOpenTime.getTime())); // 開店時間とblockEndの遅い方を次の開始時間とする
            console.log(blockEnd)
        });

        // 最後のブロック後の時間を追加
        if (currentTime < dayCloseTime && totalHours < 8) {
            let remainingHours = 8 - totalHours;
            let potentialEndTime = new Date(currentTime.getTime() + remainingHours * 3600000);
            if (potentialEndTime > dayCloseTime) {
                potentialEndTime = dayCloseTime;
            }
            if (currentTime < potentialEndTime) {
                dayShifts.push({ start: currentTime, end: potentialEndTime });
            }
        }

        availableShifts = availableShifts.concat(dayShifts);
        currentDate.setDate(currentDate.getDate() + 1); // 次の日に進む
    }

    console.log("提案されたシフト:", availableShifts);
    return availableShifts;
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
    const storeOpenTime = '08:00';     // 店舗の開店時間 (8時)
    const storeCloseTime = '23:30';    // 店舗の閉店時間 (翌2時)
    const sleepStartTime = '23:00';   // 睡眠開始時刻
    const sleepEndTime = '07:00';      // 睡眠終了時刻

    proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime)
    .then(availableShifts => {
        // 効率よく目標金額に達成するためのシフトを計算
        let totalEarnings = 0;
        let selectedShifts = [];
        availableShifts.forEach(shift => {
            let shiftStart = shift.start;
            let shiftEnd = shift.end;
            let shiftDuration = (shiftEnd - shiftStart) / 3600000; // 時間単位で変換
            let shiftEarnings = 0;

            // 深夜給と休日給の計算
            let currentHour = new Date(shiftStart);
            while (currentHour < shiftEnd) {
                let nextHour = new Date(currentHour.getTime() + 3600000);
                if (nextHour > shiftEnd) {
                    nextHour = shiftEnd;
                }
                let hourDuration = (nextHour - currentHour) / 3600000;

                // 深夜給の判定
                if (currentHour.getHours() >= 22 || currentHour.getHours() < 5) {
                    shiftEarnings += hourDuration * nightWage;
                } else {
                    shiftEarnings += hourDuration * hourlyWage;
                }

                // 休日給の判定（土曜日または日曜日）
                if (currentHour.getDay() === 0 || currentHour.getDay() === 6) {
                    shiftEarnings += hourDuration * (holidayPay - hourlyWage);
                }

                currentHour = new Date(currentHour.getTime() + 3600000);
            }

            if (totalEarnings <= targetEarnings) {
                selectedShifts.push(shift);
                totalEarnings += shiftEarnings;
            }
        });

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