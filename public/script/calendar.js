import { firebaseConfig } from '../APIkeys/firebaseAPI.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, getDocs, collection } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { escapeHTML } from './escapeHTML.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadJobData() {
    const jobsCollection = collection(db, "jobs");
    const snapshot = await getDocs(jobsCollection);
    const jobsData = [];
    snapshot.forEach(doc => {
        jobsData.push(doc.data());
    });
    return jobsData;
}


document.addEventListener('DOMContentLoaded', async function () {
    const holidaysData = await $.get("https://holidays-jp.github.io/api/v1/date.json");
    const unavailableTimes = await loadUnavailableTimes();
    const partTimeShifts = await loadPartTimeShifts();
    const jobData = await loadJobData();

    // アルバイト名と色のマッピング
    const jobColorMap = {};
    jobData.forEach(job => {
        jobColorMap[job.name] = job.color;
    });

    // シフトの重複チェック
    const uniquePartTimeShifts = partTimeShifts.filter((shift, index, self) =>
        index === self.findIndex((s) => (
            s.start === shift.start && s.end === shift.end
        ))
    );

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
        events: [...getEventDates(holidaysData), ...unavailableTimes, ...uniquePartTimeShifts],
        eventClick: function (info) {
            if (!info.event.extendedProps.holiday) {
                var eventObj = info.event;
                var content = `
                    <div class="popup-content">
                        <h3>${eventObj.title}</h3>
                        <p><strong>開始:</strong> ${eventObj.start.toLocaleString()}</p>
                        <p><strong>終了:</strong> ${eventObj.end ? eventObj.end.toLocaleString() : 'なし'}</p>
                    </div>
                `;
                const rect = info.el.getBoundingClientRect();
                showPopup(content, rect.left, rect.top, info.view.type);
            }
        },
        eventContent: function (arg) {
            let backgroundColor = '';
            let textColor = '';
            if (jobColorMap[arg.event.title]) {
                backgroundColor = `background-color: ${jobColorMap[arg.event.title]};`;
                textColor = `color: #2C3E50;`;
            }
            let customHtml = `<div class="fc-daygrid-event" style="${backgroundColor}"><div class="fc-event-title" style="${textColor} padding: 2px 4px; border-radius: 3px;">${arg.event.title}</div></div>`;
            return { html: customHtml };
        },
        
        dayCellClassNames: function (arg) {
            if (arg.date.getDay() === 0) {
                return 'fc-sun';
            } else if (arg.date.getDay() === 6) {
                return 'fc-sat';
            }
        }
    });
    calendar.render();
});

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

    async function loadUnavailableTimes() {
        const querySnapshot = await getDocs(collection(db, "unavailableTimes"));
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
}

async function loadUnavailableTimes() {
    const querySnapshot = await getDocs(collection(db, "unavailableTimes"));
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
                title: time.name,
                start: time.date + 'T' + time.startTime,
                end: time.date + 'T' + time.endTime,
                color: 'red'
            });
        } else {
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                unavailableTimes.push({
                    title: time.name,
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
    const querySnapshot = await getDocs(collection(db, "partTimeShifts"));
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
