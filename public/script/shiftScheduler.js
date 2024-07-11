import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

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
        // console.log(`Processing sleep time for date: ${date} with sleepStartTime: ${sleepStartTime} and sleepEndTime: ${sleepEndTime}`);
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
        // console.log(`Processing close time for date: ${date} with storeOpenTime: ${storeOpenTime} and storeCloseTime: ${storeCloseTime}`);
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
    console.log("loadRegisteredTimesを実行")
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
        getShifts(targetEarnings, targetMonth, lifestyle);
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
        // ここでは最初のジョブの開店時間と閉店時間を使用しますが、実際には適切なロジックで選択する必要があります。
        const storeOpenTime = jobsData[0].storeOpenTime;
        const storeCloseTime = jobsData[0].storeCloseTime;

        const newStartDate = new Date(startDate.toISOString().split('T')[0]);
        const newEndDate = new Date(endDate.toISOString().split('T')[0]);

        console.log(newStartDate, newEndDate)
        console.log(sleepStartTime, sleepEndTime)

        getUnavailableTimes(sleepStartTime, sleepEndTime, newStartDate, newEndDate, storeOpenTime, storeCloseTime).then(times => {
            console.log("目標金額:", targetEarnings);
            console.log("提案期間:", startDate.toISOString().split('T')[0], "から", endDate.toISOString().split('T')[0]);
            console.log("取得した利用不可能な時間:", times);

            console.log(startDate.toISOString().split('T')[0])
            console.log(endDate.toISOString().split('T')[0])
            console.log(storeOpenTime)
            console.log(storeCloseTime)

            console.log(lifestyle)
        }).catch(error => {
            console.error("利用不可能な時間の取得に失敗しました:", error);
        });
    }).catch(error => {
        console.error("アルバイト情報の取得に失敗しました:", error);
    });
}