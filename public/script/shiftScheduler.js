import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// モックデータを追加する関数
async function getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime) {
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

    const allTimes = [
        { date: '2024-06-01', startTime: '09:00', endTime: '12:00' },
        { date: '2024-06-05', startTime: '09:00', endTime: '12:00' },
        { date: '2024-06-10', startTime: '14:00', endTime: '16:00' },
        { date: '2024-06-15', startTime: '18:00', endTime: '20:00' },
        // 他のモックデータを追加
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

// ページ読み込み時の関数を変更
window.onload = () => {
    document.getElementById('earningsForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const targetEarnings = document.getElementById('targetEarnings').value;
        getShifts(targetEarnings);
    });
};

// getShifts関数に目標金額を引数として追加
function getShifts(targetEarnings) {
    const startDate = new Date('2024-07-01'); // シフト提案の開始日
    const endDate = new Date('2024-07-31');   // シフト提案の終了日

    loadRegisteredTimes(startDate, endDate).then(times => {
        // シフト提案ロジックをここに追加（現在は単に出力するだけ）
        console.log("目標金額:", targetEarnings);
        console.log(times);
    }).catch(error => {
        console.error("エラーが発生しました:", error);
    });
}
