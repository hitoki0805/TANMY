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
async function getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, jobData) {
    console.log("getUnavailableTimesが実行されました。");
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

    const closeTimes = [];
    jobData.forEach(job => {
        const jobCloseTimes = dateRange.map(date => {
            if (job.storeCloseTime > job.storeOpenTime) { // 日付を跨ぐ場合
                return [
                    { date: date, startTime: job.storeCloseTime, endTime: '24:00' },
                    { date: new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0], startTime: '00:00', endTime: job.storeOpenTime }
                ];
            } else {
                return { date: date, startTime: job.storeCloseTime, endTime: job.storeOpenTime };
            }
        }).flat();
        closeTimes.push(...jobCloseTimes);
    });

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

// シフトを読み込む関数を修正して重複を解消
async function loadPartTimeShifts() {
    const querySnapshot = await getDocs(collection(db, "partTimeShifts"));
    const partTimeShifts = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(today.getMonth() + 3); // 3ヶ月先までの予定を表示

    querySnapshot.forEach((docSnapshot) => {
        const time = docSnapshot.data();
        const startDate = new Date(time.date);
        const recurrence = time.recurrence;

        if (recurrence === 'none') {
            partTimeShifts.push({
                title: time.name,
                start: time.date + 'T' + time.startTime,
                end: time.date + 'T' + time.endTime,
                color: time.color // 色を適用
            });
        } else {
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                partTimeShifts.push({
                    title: time.name,
                    start: currentDate.toISOString().split('T')[0] + 'T' + time.startTime,
                    end: currentDate.toISOString().split('T')[0] + 'T' + time.endTime,
                    color: time.color // 色を適用
                });

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
    return partTimeShifts;
}

// コレクション内のすべてのドキュメントを削除する関数を追加
async function clear(collectionRef) {
    const querySnapshot = await getDocs(collectionRef);
    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
    await Promise.all(deletePromises);
}

// メイン関数
async function proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, jobData, blockedTimes) {
    console.log("プロポーズシフト実行中");
    let availableShifts = [];
    let jobTimeRanges = await getJobTimeRanges(startDate, endDate);

    for (const jobName in jobTimeRanges) {
        let jobShifts = [];
        jobTimeRanges[jobName].forEach(range => {
            let currentTime = new Date(range.openTime);
            let totalShiftDuration = 0; // その日の合計シフト時間を追跡

            while (currentTime < range.closeTime && totalShiftDuration < 8) {
                let shiftEnd = new Date(currentTime.getTime() + 8 * 3600000); // 8時間後
                if (shiftEnd > range.closeTime) shiftEnd = new Date(range.closeTime);

                let overlap = blockedTimes.some(blocked => {
                    return (new Date(blocked.date + 'T' + blocked.startTime) < shiftEnd) && (new Date(blocked.date + 'T' + blocked.endTime) > currentTime);
                });

                if (!overlap) {
                    let shiftDuration = (shiftEnd - currentTime) / 3600000; // 時間単位で計算
                    if (totalShiftDuration + shiftDuration <= 8) {
                        jobShifts.push({
                            start: new Date(currentTime),
                            end: shiftEnd,
                            jobName: jobName,
                            jobColor: jobData.find(job => job.name === jobName).color
                        });
                        totalShiftDuration += shiftDuration;
                    } else {
                        break; // これ以上シフトを追加すると8時間を超えるため終了
                    }
                }

                currentTime = new Date(shiftEnd);
            }
        });
        availableShifts = availableShifts.concat(jobShifts);
    }

    // 重複シフトを除外
    availableShifts = availableShifts.filter((shift, index, self) =>
        index === self.findIndex((s) => (
            s.start.getTime() === shift.start.getTime() && s.end.getTime() === shift.end.getTime() && s.jobName === shift.jobName
        ))
    );

    console.log("シフト候補:", availableShifts);
    return availableShifts;
}


// 曜日を文字列に変換する関数
function getWeekdayString(dayNumber) {
    const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    return weekdays[dayNumber];
}

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
        const startDate = new Date(shift.start);
        const endDate = new Date(shift.end);
        const weekday = getWeekdayString(startDate.getDay());
        li.textContent = `バイト: ${escapeHTML(shift.jobName)}, 開始: ${escapeHTML(startDate.toLocaleString())} (${escapeHTML(weekday)}), 終了: ${escapeHTML(endDate.toLocaleString())} (${escapeHTML(weekday)})`;
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
async function clearUserShifts() {
    const shiftsCollection = query(collection(db, "partTimeShifts"), where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(shiftsCollection);
    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
    await Promise.all(deletePromises);
}

// シフトをデータベースに登録する関数を追加
async function saveShiftsToDatabase(shifts) {
    const shiftsCollection = collection(db, "partTimeShifts");

    // 重複シフトを防ぐために、まずすべてのシフトをクリア
    await clearCollection(shiftsCollection);

    for (const shift of shifts) {
        const startDate = new Date(shift.start);
        const endDate = new Date(shift.end);

        const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const weekday = getWeekdayString(startDate.getDay());

        const localDate = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        await addDoc(shiftsCollection, {
            date: localDate,
            startTime: startTime,
            endTime: endTime,
            weekday: weekday,
            recurrence: 'none',
            name: shift.jobName,
            color: shift.jobColor,
            userId: currentUser.uid // ユーザIDを追加
        });

        console.log("データベースにシフトを登録しました。");
    }
}

async function deleteJobAndShifts(jobId) {
    // ジョブのドキュメントを削除
    await deleteDoc(doc(db, "jobs", jobId));

    // 対応するシフトも削除
    const shiftsQuerySnapshot = await getDocs(collection(db, "partTimeShifts"));
    const deletePromises = [];
    shiftsQuerySnapshot.forEach(docSnapshot => {
        const shift = docSnapshot.data();
        if (shift.name === jobId) {
            deletePromises.push(deleteDoc(doc(db, "partTimeShifts", docSnapshot.id)));
        }
    });
    await Promise.all(deletePromises);
}

window.onload = () => {
    document.getElementById('earningsForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const targetEarnings = document.getElementById('targetEarnings').value;
        const targetMonth = document.getElementById('targetMonth').value;
        const lifestyle = document.getElementById('lifestyle').value;
        const preferredDaysSelect = document.getElementById('preferredDays');
        let preferredDays = [];
        if (preferredDaysSelect) {
            preferredDays = Array.from(preferredDaysSelect.selectedOptions).map(option => parseInt(option.value));
        }
        getShifts(targetEarnings, targetMonth, lifestyle, preferredDays);
    });
};

//アルバイトの営業時間を取得する関数
//この関数はアルバイトの時間帯に、違うアルバイトが提案されないようにしている
async function getJobTimeRanges(startDate, endDate) {
    const jobsData = await loadJobData();
    const jobTimeRanges = {};

    jobsData.forEach(job => {
        const jobTimes = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            let openTime = new Date(`${currentDate.toISOString().split('T')[0]}T${job.storeOpenTime}`);
            let closeTime = new Date(`${currentDate.toISOString().split('T')[0]}T${job.storeCloseTime}`);

            if (closeTime < openTime) {
                closeTime.setDate(closeTime.getDate() + 1);
            }

            jobTimes.push({
                date: currentDate.toISOString().split('T')[0],
                openTime: openTime,
                closeTime: closeTime
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        jobTimeRanges[job.name] = jobTimes;
    });

    return jobTimeRanges;
}

// getShifts関数の修正
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
        if (jobsData.length === 0) {
            console.error("アルバイト情報がありません");
            return;
        }

        getUnavailableTimes(sleepStartTime, sleepEndTime, startDate, endDate, jobsData).then(blockedTimes => {
            proposeShifts(sleepStartTime, sleepEndTime, startDate, endDate, jobsData, blockedTimes)
                .then(availableShifts => {
                    let totalEarnings = 0;
                    let selectedShifts = [];

                    // 優先曜日のシフトを先に選択
                    const preferredShifts = availableShifts.filter(shift => preferredDays.includes(new Date(shift.start).getDay()));
                    const nonPreferredShifts = availableShifts.filter(shift => !preferredDays.includes(new Date(shift.start).getDay()));

                    function calculateShifts(shifts) {
                        let uniqueShifts = [];

                        shifts.forEach(shift => {
                            if (!uniqueShifts.some(s => s.start.getTime() === shift.start.getTime() && s.end.getTime() === shift.end.getTime())) {
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
                                        shiftEarnings += hourDuration * jobsData.find(job => job.name === shift.jobName).nightWage;
                                    } else {
                                        shiftEarnings += hourDuration * jobsData.find(job => job.name === shift.jobName).hourlyWage;
                                    }

                                    // 休日給の判定（土曜日または日曜日）
                                    if (currentHour.getDay() === 0 || currentHour.getDay() === 6) {
                                        shiftEarnings += hourDuration * (jobsData.find(job => job.name === shift.jobName).holidayPay - jobsData.find(job => job.name === shift.jobName).hourlyWage);
                                    }

                                    currentHour = new Date(currentHour.getTime() + 3600000);
                                }

                                if (totalEarnings < targetEarnings) {
                                    selectedShifts.push(shift);
                                    totalEarnings += shiftEarnings;
                                }
                                uniqueShifts.push(shift); // ユニークシフトリストに追加
                            }
                        });

                        return uniqueShifts;
                    }

                    // 優先曜日のシフトを計算
                    calculateShifts(preferredShifts);

                    // 目標金額に達していない場合、残りの曜日のシフトを計算
                    if (totalEarnings < targetEarnings) {
                        calculateShifts(nonPreferredShifts);
                    }

                    displayShifts(selectedShifts); // シフトを表示
                    saveShiftsToDatabase(selectedShifts); // シフトをデータベースに保存
                })
                .catch(error => {
                    console.error("エラーが発生しました:", error);
                });
        }).catch(error => {
            console.error("エラーが発生しました:", error);
        });
    }).catch(error => {
        console.error("アルバイト情報の取得に失敗しました:", error);
    });
}

