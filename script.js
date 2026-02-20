document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let activePage = 'dashboard';
    let inventoryData = null;

    const authPage = document.getElementById('authPage');
    const appContainer = document.getElementById('appContainer');

    const getAuthToken = () =>
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken');

    // ---------------- API ----------------

    async function apiCall(endpoint, method = 'GET', body = null) {
        const token = getAuthToken();

        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        try {
            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null,
                cache: 'no-store'
            });
            return await res.json();
        } catch (e) {
            console.error("API Error:", e);
            return { success: false, error: "Server error" };
        }
    }

    const showToast = (msg, type = 'success') => {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = `bg-${type === 'success' ? 'teal' : 'red'}-500 show`;
        setTimeout(() => t.classList.remove('show'), 3000);
    };

    // ---------------- DASHBOARD ----------------

    const renderDashboard = () => `
        <div class="dashboard-card p-6 text-center">
            <h2 class="text-2xl font-bold">Welcome to PillSmart</h2>
            <p class="text-gray-500 mt-2">Manage your 8-slot smart dispenser.</p>
        </div>
    `;

    // ---------------- DISPENSER MANAGER ----------------

    const renderDispenserManager = () => {

        if (!inventoryData) return `<p>Loading...</p>`;

        return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${inventoryData.slots.map(slot => `
                <div class="dashboard-card p-5" data-slot="${slot.slot_number}">
                    <h2 class="text-xl font-bold text-teal-600 mb-2">
                        Slot ${slot.slot_number}
                    </h2>

                    <p class="text-sm text-gray-500 mb-3">
                        Tablets Left: 
                        <span class="font-bold">${slot.tablets_left}</span>
                    </p>

                    <input type="text"
                        class="slot-med-name w-full p-2 border rounded mb-2"
                        value="${slot.medicine_name || ''}"
                        placeholder="Medicine Name">

                    <input type="number"
                        min="0"
                        class="slot-total w-full p-2 border rounded mb-3"
                        value="${slot.total_tablets || ''}"
                        placeholder="Total Tablets">

                    <div class="schedule-container space-y-2 mb-2">
                        ${slot.schedules.map(s => `
                            <div class="flex gap-2">
                                <input type="time"
                                    class="slot-time p-2 border rounded flex-1"
                                    value="${s.time}">
                                <input type="number"
                                    min="1"
                                    class="slot-dosage p-2 border rounded flex-1"
                                    value="${s.dosage}">
                                <button class="remove-time text-red-500">✕</button>
                            </div>
                        `).join('')}
                    </div>

                    <button class="add-time-btn text-sm text-teal-600 hover:underline mb-2">
                        + Add Time
                    </button>

                    <button class="save-slot-btn primary-btn w-full">
                        Save Slot
                    </button>
                </div>
            `).join('')}
        </div>
        `;
    };

    // ---------------- LOGS ----------------

    const renderLogsPage = (logsData) => {

        const rows = logsData.map(log => `
            <tr class="border-b">
                <td class="py-3 px-4">${log.time}</td>
                <td class="py-3 px-4">Slot ${log.slot_number}</td>
                <td class="py-3 px-4">${log.medicine_name}</td>
                <td class="py-3 px-4">${log.dosage}</td>
            </tr>
        `).join('');

        return `
        <div class="dashboard-card">
            <h2 class="text-xl font-bold mb-4">Dispense History</h2>
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b-2 bg-gray-50">
                        <th class="px-4 py-3">Time</th>
                        <th class="px-4 py-3">Slot</th>
                        <th class="px-4 py-3">Medicine</th>
                        <th class="px-4 py-3">Dosage</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || `<tr><td colspan="4" class="text-center py-6">No logs</td></tr>`}
                </tbody>
            </table>
        </div>
        `;
    };

    // ---------------- NAV ----------------

    const navItems = [
        { id: 'dashboard', name: 'Dashboard', icon: 'ph-house' },
        { id: 'dispenser', name: 'Dispenser Manager', icon: 'ph-pill' },
        { id: 'logs', name: 'Logs / History', icon: 'ph-clipboard-text' }
    ];

    const updateNavs = () => {
        const sb = document.getElementById('sidebar-nav');
        sb.innerHTML = '';

        navItems.forEach(i => {
            sb.innerHTML += `
                <a href="#" data-page="${i.id}"
                   class="nav-link flex items-center gap-3 px-6 py-3 mx-2 my-1 rounded-lg
                   ${i.id === activePage ? 'bg-teal-50 text-teal-600 font-bold'
                    : 'text-gray-600 hover:bg-gray-100'}">
                    <i class="ph-bold ${i.icon} text-xl"></i>
                    ${i.name}
                </a>`;
        });
    };

    // ---------------- PAGE SWITCH ----------------

    const showPage = async (pid) => {

        activePage = pid;
        let content = '';

        if (pid === 'dashboard') {
            content = renderDashboard();
        }

        else if (pid === 'dispenser') {
            inventoryData = await apiCall('/get_inventory');
            content = renderDispenserManager();
        }

        else if (pid === 'logs') {
            const logs = await apiCall('/get_logs');
            content = renderLogsPage(Array.isArray(logs) ? logs : []);
        }

        document.getElementById('page-title').textContent =
            navItems.find(i => i.id === pid)?.name || "PillSmart";

        document.getElementById('page-content').innerHTML = content;
        updateNavs();

        if (pid === 'dispenser') {

            document.querySelectorAll('.add-time-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const container =
                        btn.parentElement.querySelector('.schedule-container');

                    const row = document.createElement('div');
                    row.className = "flex gap-2";
                    row.innerHTML = `
                        <input type="time" class="slot-time p-2 border rounded flex-1">
                        <input type="number" min="1"
                               class="slot-dosage p-2 border rounded flex-1"
                               placeholder="Dosage">
                        <button class="remove-time text-red-500">✕</button>
                    `;
                    container.appendChild(row);

                    row.querySelector('.remove-time')
                        .addEventListener('click', () => row.remove());
                });
            });

            document.querySelectorAll('.save-slot-btn').forEach(btn => {
                btn.addEventListener('click', async () => {

                    const card = btn.closest('[data-slot]');
                    const slot_number = parseInt(card.dataset.slot);

                    const medName =
                        card.querySelector('.slot-med-name').value;

                    const total =
                        parseInt(card.querySelector('.slot-total').value) || 0;

                    const schedules = [];

                    card.querySelectorAll('.schedule-container > div')
                        .forEach(row => {

                            const time =
                                row.querySelector('.slot-time').value;

                            const dosage =
                                parseInt(row.querySelector('.slot-dosage').value);

                            if (time && dosage) {
                                schedules.push({ time, dosage });
                            }
                        });

                    await apiCall('/update_slot', 'POST', {
                        slot_number,
                        medicine_name: medName,
                        total_tablets: total,
                        schedules
                    });

                    showToast("Slot Updated!");
                    showPage('dispenser');
                });
            });
        }
    };

    // ---------------- AUTH ----------------

    function showApp() {
        authPage.classList.add('page-hidden');
        appContainer.classList.remove('page-hidden');
        showPage('dashboard');
    }

    function showAuth() {
        appContainer.classList.add('page-hidden');
        authPage.classList.remove('page-hidden');
    }

    document.body.addEventListener('click', (e) => {
        const nav = e.target.closest('.nav-link');
        if (nav) {
            e.preventDefault();
            showPage(nav.dataset.page);
        }
    });

    if (getAuthToken()) showApp();
    else showAuth();

});
