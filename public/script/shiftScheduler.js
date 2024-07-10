import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// 使用例
const startDate = new Date('2024-07-01'); // シフト提案の開始日
const endDate = new Date('2024-07-31');   // シフト提案の終了日

loadRegisteredTimes(startDate, endDate).then(times => {
    console.log(times);
}).catch(error => {
    console.error("エラーが発生しました:", error);
});