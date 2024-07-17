import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection, addDoc, deleteDoc, doc, query, where } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { escapeHTML } from './escapeHTML.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadJobData().then(data => {
            console.log("取得したアルバイト情報:", data);
        }).catch(error => {
            console.error("アルバイト情報の取得に失敗しました:", error);
        });
    } else {
        // ユーザが認証されていない場合、ログインページにリダイレクト
        window.location.href = 'authentication.html';
    }
});

// アルバイト情報を取得する関数を追加
async function loadJobData() {
    const jobsCollection = query(collection(db, "jobs"), where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(jobsCollection);
    const jobsData = [];
    snapshot.forEach(doc => {
        jobsData.push(doc.data());
    });
    return jobsData;
}

// モックデータを追加する関数
async function getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime) {
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

    const registeredTimes = await loadRegisteredTimes(new Date(startDate), new Date(endDate));

    const allTimes = [
        ...registeredTimes,
        ...sleepTimes,
        ...closeTimes
    ];

    return allTimes.sort((a, b) => {
        let dateTimeA = new Date(`${a.date}T${a.startTime}`);
        let dateTimeB = new Date(`${b.date}T${b.startTime}`);
        return dateTimeA - dateTimeB;
    });
}

async function loadRegisteredTimes(startDate, endDate) {
    const querySnapshot = await getDocs(query(collection(db, "unavailableTimes"), where("userId", "==", currentUser.uid)));
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

// シフトをページに表示する関数
function displayShifts(shifts, totalEarnings) {
    const suggestedShiftsDiv = document.getElementById('suggestedShifts');
    suggestedShiftsDiv.innerHTML = ''; // 既存の内容をクリア

    if (shifts.length === 0) {
        suggestedShiftsDiv.innerHTML = '<p>提案されたシフトはありません。</p>';
        return;
    }

    const ul = document.createElement('ul');
    shifts.forEach(shift => {
        const li = document.createElement('li');
        const startDate = new Date(shift.start);
        const endDate = new Date(shift.end);
        const weekday = getWeekdayString(startDate.getDay());
        li.textContent = `開始: ${escapeHTML(startDate.toLocaleString())} (${escapeHTML(weekday)}), 終了: ${escapeHTML(endDate.toLocaleString())} (${escapeHTML(weekday)})`;
        ul.appendChild(li);
    });
    suggestedShiftsDiv.appendChild(ul);

    // 合計金額を表示
    const totalEarningsDiv = document.createElement('div');
    totalEarningsDiv.innerHTML = `<p>合計金額: ${totalEarnings.toLocaleString()}円</p>`;
    suggestedShiftsDiv.appendChild(totalEarningsDiv);
}

// 曜日を文字列に変換する関数
function getWeekdayString(dayNumber) {
    const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    return weekdays[dayNumber];
}

// コレクション内のすべてのドキュメントを削除する関数
async function clearUserShifts() {
    const shiftsCollection = query(collection(db, "partTimeShifts"), where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(shiftsCollection);
    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
    await Promise.all(deletePromises);
}

async function saveShiftsToDatabase(shifts) {
    const shiftsCollection = collection(db, "partTimeShifts");

    await clearUserShifts(); // ユーザのシフトのみ削除

    const jobsData = await loadJobData();

    for (const shift of shifts) {
        const startDate = new Date(shift.start);
        const endDate = new Date(shift.end);

        const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const weekday = getWeekdayString(startDate.getDay());

        const localDate = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        const jobName = jobsData[0].name;
        const jobColor = jobsData[0].color;

        await addDoc(shiftsCollection, {
            date: localDate,
            startTime: startTime,
            endTime: endTime,
            weekday: weekday,
            recurrence: 'none',
            name: jobName,
            color: jobColor,
            userId: currentUser.uid // ユーザIDを追加
        });
        console.log("データベースにシフトを登録しました。")
    }
}

window.onload = () => {
    document.getElementById('earningsForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const targetEarnings = document.getElementById('targetEarnings').value;
        const targetMonth = document.getElementById('targetMonth').value;
        const lifestyle = document.getElementById('lifestyle').value;
        const preferredDays = Array.from(document.getElementById('preferredDays').selectedOptions).map(option => parseInt(option.value)); // 優先曜日の選択を取得
        
        // 選択された曜日をコンソールに表示
        console.log("選択された優先曜日:", preferredDays);

        getShifts(targetEarnings, targetMonth, lifestyle, preferredDays);
    });
};

async function proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay, weeklyHoliday, monthlyHolidays) {
    const blockedTimes = await getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay);
    console.log("登録されている予定", blockedTimes);

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

        // 定休日（曜日）をチェック
        if (weeklyHoliday.includes(getWeekdayString(currentDate.getDay()))) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        // 定休日（日付）をチェック
        if (monthlyHolidays.includes(currentDate.getDate().toString())) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

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
        });

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

    console.log("定休日削除前のシフト候補：", availableShifts)

    // 定休日のシフトを削除
    availableShifts = availableShifts.filter(shift => {
        const shiftDate = new Date(shift.start);
        const shiftDay = shiftDate.getDay();
        const shiftDayOfMonth = shiftDate.getDate();
        return !weeklyHoliday.includes(getWeekdayString(shiftDay)) && !monthlyHolidays.includes(shiftDayOfMonth.toString());
    });

    console.log("シフト候補:", availableShifts);
    return availableShifts;
}

// getShifts関数に月を引数として追加
function getShifts(targetEarnings, targetMonth, lifestyle, preferredDays) {
    const year = targetMonth.split('-')[0];
    const month = parseInt(targetMonth.split('-')[1], 10)
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

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
        const storeOpenTime = jobsData[0].storeOpenTime;
        const storeCloseTime = jobsData[0].storeCloseTime;
        const hourlyWage = jobsData[0].hourlyWage;
        const nightWage = jobsData[0].nightWage;
        const holidayPay = jobsData[0].holidayPay;
        const weeklyHoliday = jobsData[0].weeklyHoliday || [];
        const monthlyHolidays = jobsData[0].monthlyHolidays || [];
        console.log(weeklyHoliday);
        console.log(monthlyHolidays);

        proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, storeOpenTime, storeCloseTime, hourlyWage, nightWage, holidayPay, weeklyHoliday, monthlyHolidays).then(availableShifts => {
            let totalEarnings = 0;
            let selectedShifts = [];

            // 優先曜日のシフトを先に選択
            const preferredShifts = availableShifts.filter(shift => preferredDays.includes(new Date(shift.start).getDay()));
            const nonPreferredShifts = availableShifts.filter(shift => !preferredDays.includes(new Date(shift.start).getDay()));

            function calculateShifts(shifts) {
                shifts.forEach(shift => {
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

                    if (totalEarnings < targetEarnings) {
                        selectedShifts.push(shift);
                        totalEarnings += shiftEarnings;
                    }
                });
            }

            // 優先曜日のシフトを計算
            calculateShifts(preferredShifts);

            // 目標金額に達していない場合、残りの曜日のシフトを計算
            if (totalEarnings < targetEarnings) {
                calculateShifts(nonPreferredShifts);
            }

            displayShifts(selectedShifts, totalEarnings); // シフトと合計金額を表示
            saveShiftsToDatabase(selectedShifts); // シフトをデータベースに保存
        }).catch(error => {
            console.error("エラーが発生しました:", error);
        });
    }).catch(error => {
        console.error("アルバイト情報の取得に失敗しました:", error);
    });
}
