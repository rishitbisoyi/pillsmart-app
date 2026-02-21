document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let slots = [];
    let dispenseLogs = [];
    let userDetails = { name: "", email: "", phone: "", profile_pic: "", custom_ringtone: "" };
    let activePage = 'dashboard';

    const getAuthToken = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    async function apiCall(endpoint, method='GET', body=null) {
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? {'Authorization': `Bearer ${token}`} : {})
        };
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            cache: 'no-store'
        });
        return await res.json();
    }

    /* ====================== DASHBOARD ====================== */

    const renderDashboard = () => {
        const totalSlotsUsed = slots.filter(s => s.medicine_name).length;
        const totalTablets = slots.reduce((sum, s) => sum + s.tablets_left, 0);

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="dashboard-card p-6">
                    <h3 class="text-lg font-semibold mb-2">Active Slots</h3>
                    <p class="text-3xl font-bold text-teal-600">${totalSlotsUsed} / 8</p>
                </div>
                <div class="dashboard-card p-6">
                    <h3 class="text-lg font-semibold mb-2">Total Tablets Left</h3>
                    <p class="text-3xl font-bold text-blue-600">${totalTablets}</p>
                </div>
            </div>
        `;
    };

    /* ====================== DISPENSER MANAGER ====================== */

    const renderDispenserManager = () => {

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${slots.map(slot => `
                    <div class="dashboard-card p-5">
                        <h3 class="text-lg font-bold mb-2">Slot ${slot.slot_number}</h3>
                        <p><b>Medicine:</b> ${slot.medicine_name || 'Empty'}</p>
                        <p><b>Tablets:</b> ${slot.tablets_left} / ${slot.total_tablets}</p>

                        <div class="mt-3">
                            <b>Schedules:</b>
                            ${slot.schedules.length > 0 ? slot.schedules.map(s =>
                                `<div class="text-sm text-gray-600">${s.time} → ${s.dosage} tab</div>`
                            ).join('') : `<div class="text-sm text-gray-400">No schedules</div>`}
                        </div>

                        <div class="mt-4 flex gap-2 flex-wrap">
                            <button class="edit-slot-btn bg-blue-500 text-white px-3 py-1 rounded"
                                data-slot="${slot.slot_number}">Edit</button>

                            <button class="clear-slot-btn bg-red-500 text-white px-3 py-1 rounded"
                                data-slot="${slot.slot_number}">Clear</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    /* ====================== LOGS ====================== */

    const renderLogs = () => {
        return `
            <div class="dashboard-card p-6">
                <h2 class="text-xl font-bold mb-4">Dispense Logs</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b bg-gray-50">
                                <th class="p-2">Time</th>
                                <th class="p-2">Slot</th>
                                <th class="p-2">Medicine</th>
                                <th class="p-2">Dosage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dispenseLogs.map(log => `
                                <tr class="border-b">
                                    <td class="p-2">${log.time}</td>
                                    <td class="p-2">${log.slot_number}</td>
                                    <td class="p-2">${log.medicine_name}</td>
                                    <td class="p-2">${log.dosage}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    /* ====================== PAGE SWITCH ====================== */

    const showPage = (page) => {
        activePage = page;
        const content = document.getElementById('page-content');

        if(page === 'dashboard') content.innerHTML = renderDashboard();
        else if(page === 'dispenser') content.innerHTML = renderDispenserManager();
        else if(page === 'logs') content.innerHTML = renderLogs();
    };

    /* ====================== DATA LOAD ====================== */

    async function refreshData() {
        if(!getAuthToken()) return;

        const [s, l] = await Promise.all([
            apiCall('/get_slots'),
            apiCall('/get_logs')
        ]);

        slots = Array.isArray(s) ? s : [];
        dispenseLogs = Array.isArray(l) ? l : [];

        showPage(activePage);
    }

    /* ====================== SLOT ACTIONS ====================== */

    document.body.addEventListener('click', async (e) => {

        const editBtn = e.target.closest('.edit-slot-btn');
        if(editBtn) {
            const slotNumber = parseInt(editBtn.dataset.slot);
            const name = prompt("Medicine name:");
            const total = parseInt(prompt("Total tablets:"));
            const left = parseInt(prompt("Tablets left:"));

            const schedules = [];
            while(confirm("Add schedule time?")) {
                const time = prompt("Time (HH:MM 24h format)");
                const dosage = parseInt(prompt("Dosage tablets:"));
                schedules.push({time, dosage});
            }

            await apiCall('/update_slot', 'POST', {
                slot_number: slotNumber,
                medicine_name: name,
                total_tablets: total,
                tablets_left: left,
                schedules: schedules
            });

            refreshData();
        }

        const clearBtn = e.target.closest('.clear-slot-btn');
        if(clearBtn) {
            const slotNumber = parseInt(clearBtn.dataset.slot);
            if(confirm("Clear this slot?")) {
                await apiCall('/clear_slot', 'POST', {slot_number: slotNumber});
                refreshData();
            }
        }
    });

    /* ====================== NAVIGATION ====================== */

    document.getElementById('sidebar-nav').innerHTML = `
        <a href="#" data-page="dashboard" class="nav-link block p-3">Dashboard</a>
        <a href="#" data-page="dispenser" class="nav-link block p-3">Dispenser Manager</a>
        <a href="#" data-page="logs" class="nav-link block p-3">Logs</a>
    `;

    document.body.addEventListener('click', (e) => {
        const nav = e.target.closest('.nav-link');
        if(nav) {
            e.preventDefault();
            showPage(nav.dataset.page);
        }
    });

    /* ====================== INIT ====================== */

    if(getAuthToken()) refreshData();
});
