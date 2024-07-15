import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection, query, where } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { escapeHTML } from './escapeHTML.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initializeCalendar();
    } else {
        // ユーザが認証されていない場合、ログインページにリダイレクト
        window.location.href = 'login.html';
    }
});

async function loadJobData() {
    const jobsCollection = query(collection(db, "jobs"), where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(jobsCollection);
    const jobsData = [];
    snapshot.forEach(doc => {
        jobsData.push(doc.data());
    });
    return jobsData;
}

async function initializeCalendar() {
    const holidaysData = await $.get("https://holidays-jp.github.io/api/v1/date.json");
    const unavailableTimes = await loadUnavailableTimes();
    const partTimeShifts = await loadPartTimeShifts();
    const jobData = await loadJobData();

    // アルバイト名と色のマッピング
    const jobColorMap = {};
    jobData.forEach(job => {
        jobColorMap[job.name] = job.color;
    });

    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridDay,timeGridWeek,dayGridMonth'
        },
        initialView: 'dayGridMonth',
        navLinks: true,
        editable: true,
        dayMaxEvents: true,
        events: [...getEventDates(holidaysData), ...unavailableTimes, ...partTimeShifts],
        eventClick: function (info) {
            if (!info.event.extendedProps.holiday) {
                var eventObj = info.event;
                var content = `
                    <div class="popup-content">
                        <h3>${escapeHTML(eventObj.title)}</h3>
                        <p><strong>開始:</strong> ${escapeHTML(eventObj.start.toLocaleString())}</p>
                        <p><strong>終了:</strong> ${eventObj.end ? escapeHTML(eventObj.end.toLocaleString()) : 'なし'}</p>
                    </div>
                `;
                // イベントの位置を取得してポップアップを表示
                const rect = info.el.getBoundingClientRect();
                showPopup(content, rect.right, rect.top);
            }
        },
        eventContent: function (arg) {
            let backgroundColor = '';
            let textColor = '';
            if (jobColorMap[arg.event.title]) {
                backgroundColor = `background-color: ${jobColorMap[arg.event.title]};`;
                textColor = `color: white;`;
            }
            // 予定の名称を表示
            let customHtml = '<div class="fc-event-title">' + escapeHTML(arg.event.title) + '</div>';
            return { html: customHtml };
        },
        dayCellClassNames: function (arg) {
            if (arg.date.getDay() === 0) {
                return 'fc-sun';
            } else if (arg.date.getDay() === 6) {
                return 'fc-sat';
            } else if (isHoliday(arg.date, holidaysData)) { // 祝日を赤色に設定
                return 'fc-holiday';
            }
        }
    });
    calendar.render();
}

function getEventDates(holidaysData) {
    var eventDates = [];
    var holidays = Object.keys(holidaysData);
    for (var i = 0; i < holidays.length; i++) {
        var holiday = {
            title: escapeHTML(holidaysData[holidays[i]]),
            start: holidays[i],
            className: "holiday",
            holiday: holidays[i],
            color: 'red'
        };
        eventDates.push(holiday);
    }
    return eventDates;
}

function isHoliday(date, holidaysData) {
    var dateString = date.toISOString().split('T')[0];
    return holidaysData.hasOwnProperty(dateString);
}

async function loadUnavailableTimes() {
    const querySnapshot = await getDocs(query(collection(db, "unavailableTimes"), where("userId", "==", currentUser.uid)));
    const unavailableTimes = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(today.getMonth() + 3);

    querySnapshot.forEach((docSnapshot) => {
        const time = docSnapshot.data();
        const startDate = new Date(time.date);
        const recurrence = time.recurrence;

        if (recurrence === 'none') {
            unavailableTimes.push({
                title: escapeHTML(time.name), // 予定の名称を追加
                start: time.date + 'T' + time.startTime,
                end: time.date + 'T' + time.endTime,
                color: 'red'
            });
        } else {
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                unavailableTimes.push({
                    title: escapeHTML(time.name), // 予定の名称を追加
                    start: currentDate.toISOString().split('T')[0] + 'T' + time.startTime,
                    end: currentDate.toISOString().split('T')[0] + 'T' + time.endTime,
                    color: 'red'
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
    return unavailableTimes;
}

async function loadPartTimeShifts() {
    const querySnapshot = await getDocs(query(collection(db, "partTimeShifts"), where("userId", "==", currentUser.uid)));
    const partTimeShifts = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(today.getMonth() + 3);

    querySnapshot.forEach((docSnapshot) => {
        const time = docSnapshot.data();
        const startDate = new Date(time.date);
        const recurrence = time.recurrence;

        if (recurrence === 'none') {
            partTimeShifts.push({
                title: escapeHTML(time.name), // 予定の名称を追加
                start: time.date + 'T' + time.startTime,
                end: time.date + 'T' + time.endTime,
                color: time.color // ここで色を適用
            });
        } else {
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                partTimeShifts.push({
                    title: escapeHTML(time.name), // 予定の名称を追加
                    start: currentDate.toISOString().split('T')[0] + 'T' + time.startTime,
                    end: currentDate.toISOString().split('T')[0] + 'T' + time.endTime,
                    color: time.color // ここで色を適用
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

function showPopup(content, x, y, viewType) {
    const existingPopup = document.querySelector('.popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = content;
    document.body.appendChild(popup);

    if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
        popup.style.left = `${x}px`;
        popup.style.top = `${y + window.scrollY + popup.getBoundingClientRect().height}px`;
    } else {
        popup.style.left = `${x + window.scrollX}px`;
        popup.style.top = `${y + window.scrollY}px`;
    }

    setTimeout(() => {
        document.addEventListener('click', function removePopup(event) {
            if (!popup.contains(event.target)) {
                popup.remove();
                document.removeEventListener('click', removePopup);
            }
        });
    }, 0);
}