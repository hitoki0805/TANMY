import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection, addDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// モックデータを追加する関数
async function getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime) {
    // 開始日と終了日の間の日付を生成
    console.log("getUnavailableTimesが実行されました。")
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

    const closeTimes = dateRange.map(date => {
        if (storeCloseTime > storeOpenTime) { // 日付を跨ぐ場合
            return [
                { date: date, startTime: storeCloseTime, endTime: '24:00' },
                { date: new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0], startTime: '00:00', endTime: storeOpenTime }
            ];
        } else {
            return { date: date, startTime: storeCloseTime, endTime: storeOpenTime };
        }
    }).flat();

    console.log("Sleep times:", sleepTimes);
    console.log("Close times:", closeTimes);

    // データベースから取得した予定を含める
    const registeredTimes = await loadRegisteredTimes(new Date(startDate), new Date(endDate));

    const allTimes = [
        ...registeredTimes,
        ...sleepTimes,
        ...closeTimes
    ];

    // 日時でソート
    return allTimes.sort((a, b) => {
        let dateTimeA = new Date(`${a.date}T${a.startTime}`);
        let dateTimeB = new Date(`${b.date}T${b.startTime}`);
        return dateTimeA - dateTimeB;
    });
}

async function loadRegisteredTimes(startDate, endDate) {
    // console.log("loadRegisteredTimesを実行")
    const querySnapshot = await getDocs(collection(db, "unavailableTimes"));
    const registeredTimes = [];

    querySnapshot.forEach((docSnapshot) => {
        const time = docSnapshot.data();
        const baseDate = new Date(time.date);
        const recurrence = time.recurrence;

        if (recurrence === 'none') {
            if (baseDate >= startDate && baseDate <= endDate) {
                registeredTimes.push({
                    date: time.date,
                    startTime: time.startTime,
                    endTime: time.endTime
                });
            }
        } else {
            let currentDate = new Date(baseDate);
            while (currentDate <= endDate) {
                if (currentDate >= startDate && currentDate <= endDate) {
                    registeredTimes.push({
                        date: currentDate.toISOString().split('T')[0],
                        startTime: time.startTime,
                        endTime: time.endTime
                    });
                }

                if (recurrence === 'daily') {
                    currentDate.setDate(currentDate.getDate() + 1);
                } else if (recurrence === 'weekly') {
                    currentDate.setDate(currentDate.getDate() + 7);
                } else if (recurrence === 'monthly') {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            }
        }
    });

    return registeredTimes;
}

// アルバイト情報を取得する関数を追加
async function loadJobData() {
    const jobsCollection = collection(db, "jobs");
    const snapshot = await getDocs(jobsCollection);
    const jobsData = [];
    snapshot.forEach(doc => {
        jobsData.push(doc.data());
    });
    return jobsData;
}

// メイン関数
async function proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay) {
    const blockedTimes = await getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay);
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

        // console.log(dayOpenTime)

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
            // console.log(blockEnd)
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

    console.log("シフト候補:", availableShifts);
    return availableShifts;
}

// シフトをページに表示する関数を追加
function displayShifts(shifts) {
    const suggestedShiftsDiv = document.getElementById('suggestedShifts');
    suggestedShiftsDiv.innerHTML = ''; // 既存の内容をクリア

    if (shifts.length === 0) {
        suggestedShiftsDiv.innerHTML = '<p>提案されたシフトはありません。</p>';
        return;
    }

    const ul = document.createElement('ul');
    shifts.forEach(shift => {
        const li = document.createElement('li');
        li.textContent = `開始: ${shift.start.toLocaleString()}, 終了: ${shift.end.toLocaleString()}`;
        ul.appendChild(li);
    });
    suggestedShiftsDiv.appendChild(ul);
}

// 曜日を文字列に変換する関数
function getWeekdayString(dayNumber) {
    const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    return weekdays[dayNumber];
}

// コレクション内のすべてのドキュメントを削除する関数
async function clearCollection(collectionRef) {
    const querySnapshot = await getDocs(collectionRef);
    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
    await Promise.all(deletePromises);
}

// シフトをデータベースに登録する関数を追加
async function saveShiftsToDatabase(shifts) {
    const shiftsCollection = collection(db, "partTimeShifts");

    // コレクション内の既存のデータを削除
    await clearCollection(shiftsCollection);

    // 新しいシフトデータを追加
    for (const shift of shifts) {
        const startDate = new Date(shift.start);
        const endDate = new Date(shift.end);

        // ローカル時間を取得し、2桁で表示するようにフォーマット
        const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const weekday = getWeekdayString(startDate.getDay());

        // ローカルの日付を取得
        const localDate = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        await addDoc(shiftsCollection, {
            date: localDate, // ローカルの日付を使用
            startTime: startTime,
            endTime: endTime,
            weekday: weekday,
            recurrence: 'none',
            name: 'アルバイト'
        });
        console.log("データベースにシフトを登録しました。")
    }
}

// ページ読み込み時にアルバイト情報と利用不可能な時間を取得してコンソールに表示するように変更
window.onload = () => {
    loadJobData().then(data => {
        console.log("取得したアルバイト情報:", data);
    }).catch(error => {
        console.error("アルバイト情報の取得に失敗しました:", error);
    });

    document.getElementById('earningsForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const targetEarnings = document.getElementById('targetEarnings').value;
        const targetMonth = document.getElementById('targetMonth').value;
        const lifestyle = document.getElementById('lifestyle').value; // 生活習慣の選択を取得
        const preferredDays = Array.from(document.getElementById('preferredDays').selectedOptions).map(option => parseInt(option.value)); // 優先曜日の選択を取得
        
        // 選択された曜日をコンソールに表示
        console.log("選択された優先曜日:", preferredDays);

        getShifts(targetEarnings, targetMonth, lifestyle, preferredDays);
    });
};

// getShifts関数に月を引数として追加
function getShifts(targetEarnings, targetMonth, lifestyle) {
    const year = targetMonth.split('-')[0];
    const month = parseInt(targetMonth.split('-')[1], 10);
    const startDate = new Date(Date.UTC(year, month - 1, 1)); // 選択された月の初日をUTCで設定
    const endDate = new Date(Date.UTC(year, month, 0));      // 選択された月の最終日をUTCで設定

    // 生活習慣に基づいてsleepStartTimeとsleepEndTimeを設定
    let sleepStartTime, sleepEndTime;
    if (lifestyle === 'morning') {
        sleepStartTime = '22:00';
        sleepEndTime = '06:00';
    } else if (lifestyle === 'night') {
        sleepStartTime = '02:00';
        sleepEndTime = '10:00';
    } else {
        sleepStartTime = '23:00';
        sleepEndTime = '07:00';
    }

    loadJobData().then(jobsData => {
        // バイトの掛け持ちに対応する場合は、ここを修正
        const storeOpenTime = jobsData[0].storeOpenTime;
        const storeCloseTime = jobsData[0].storeCloseTime;
        const hourlyWage = jobsData[0].hourlyWage;
        const nightWage = jobsData[0].nightWage;
        const holidayPay = jobsData[0].holidayPay;

        const newStartDate = new Date(startDate.toISOString().split('T')[0]);
        const newEndDate = new Date(endDate.toISOString().split('T')[0]);

        console.log(newStartDate, newEndDate)
        console.log(sleepStartTime, sleepEndTime)

        getUnavailableTimes(sleepStartTime, sleepEndTime, newStartDate, newEndDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay).then(times => {
            console.log("目標金額:", targetEarnings);
            console.log("提案期間:", startDate.toISOString().split('T')[0], "から", endDate.toISOString().split('T')[0]);
            console.log("取得した利用不可能な時間:", times);

            console.log(startDate.toISOString().split('T')[0])
            console.log(endDate.toISOString().split('T')[0])
            console.log(storeOpenTime)
            console.log(storeCloseTime)

            console.log(lifestyle)

            console.log("proposeShiftsの実行を開始します")
            proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay, hourlyWage, nightWage, holidayPay)
            .then(availableShifts => {
                console.log("proposeShiftsの実行を開始しました")
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
        
                displayShifts(selectedShifts); // シフトを表示
                saveShiftsToDatabase(selectedShifts); // シフトをデータベースに保存
            })
            .catch(error => {
                console.error("エラーが発生しました:", error);
            });
        }).catch(error => {
            console.error("利用不可能な時間の取得に失敗しました:", error);
        });
    }).catch(error => {
        console.error("アルバイト情報の取得に失敗しました:", error);
    });
}