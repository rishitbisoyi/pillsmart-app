document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = ''; 
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let slots = [];
    let dispenseLogs = [];
    let userDetails = { name: "", email: "", phone: "", profile_pic: "", custom_ringtone: "" };
    let activePage = 'dashboard';

    const authPage = document.getElementById('authPage');
    const appContainer = document.getElementById('appContainer');
    const loginFormContainer = document.getElementById('login-form-container');
    const signupFormContainer = document.getElementById('signup-form-container');
    const forgotPasswordContainer = document.getElementById('forgot-password-container');

    const getAuthToken = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    /* ================= API ================= */

    async function apiCall(endpoint, method='GET', body=null) {
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        return await res.json();
    }

    /* ================= AUTH ================= */

    function performLogout() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }

    async function login(email, password) {
        const res = await apiCall('/login', 'POST', { email, password });

        if (res.success) {
            localStorage.setItem('authToken', res.token);
            localStorage.setItem('userName', res.name);
            localStorage.setItem('userEmail', res.email);
            window.location.reload();
        } else {
            showToast(res.error || "Login failed", 'error');
        }
    }

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        login(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await apiCall('/register', 'POST', {
            name: document.getElementById('signup-name').value,
            email: document.getElementById('signup-email').value,
            password: document.getElementById('signup-password').value
        });

        if (res.success) {
            showToast("Registered successfully!");
            loginFormContainer.classList.remove('page-hidden');
            signupFormContainer.classList.add('page-hidden');
        } else {
            showToast(res.error, 'error');
        }
    });

    /* ================= DASHBOARD ================= */

    const renderDashboard = () => {
        const active = slots.filter(s => s.medicine_name).length;
        const totalTablets = slots.reduce((sum, s) => sum + s.tablets_left, 0);

        return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="dashboard-card">
                <h3 class="text-lg font-semibold">Active Slots</h3>
                <p class="text-3xl font-bold text-teal-600">${active} / 8</p>
            </div>
            <div class="dashboard-card">
                <h3 class="text-lg font-semibold">Total Tablets Left</h3>
                <p class="text-3xl font-bold text-blue-600">${totalTablets}</p>
            </div>
        </div>`;
    };

    /* ================= DISPENSER MANAGER ================= */

    const renderSchedulePage = () => {
        return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${slots.map(slot => `
                <div class="dashboard-card p-5">
                    <h3 class="text-lg font-bold mb-2">Slot ${slot.slot_number}</h3>
                    <p><b>Medicine:</b> ${slot.medicine_name || 'Empty'}</p>
                    <p><b>Tablets:</b> ${slot.tablets_left} / ${slot.total_tablets}</p>

                    <div class="mt-3">
                        <b>Schedules:</b>
                        ${slot.schedules.length > 0
                            ? slot.schedules.map(s =>
                                `<div class="text-sm text-gray-600">${s.time} → ${s.dosage} tab</div>`
                              ).join('')
                            : `<div class="text-sm text-gray-400">No schedules</div>`
                        }
                    </div>

                    <div class="mt-4 flex gap-2">
                        <button class="edit-slot-btn bg-blue-500 text-white px-3 py-1 rounded"
                            data-slot="${slot.slot_number}">Edit</button>

                        <button class="clear-slot-btn bg-red-500 text-white px-3 py-1 rounded"
                            data-slot="${slot.slot_number}">Clear</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
    };

    /* ================= LOGS ================= */

    const renderLogsPage = () => {
        return `
        <div class="dashboard-card">
            <h2 class="text-xl font-bold mb-4">Dispense Logs</h2>
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
        </div>`;
    };

    /* ================= NAVIGATION ================= */

    const navItems = [
        {id:'dashboard',name:'Dashboard'},
        {id:'schedule',name:'Dispenser Manager'},
        {id:'logs',name:'Logs / History'}
    ];

    const showPage = (pid) => {
        activePage = pid;
        let content = '';

        if(pid==='dashboard') content = renderDashboard();
        if(pid==='schedule') content = renderSchedulePage();
        if(pid==='logs') content = renderLogsPage();

        document.getElementById('page-content').innerHTML = content;
    };

    /* ================= SLOT ACTIONS ================= */

    document.body.addEventListener('click', async (e) => {

        if(e.target.closest('#logout-btn')) performLogout();

        const nav = e.target.closest('.nav-link');
        if(nav) {
            e.preventDefault();
            showPage(nav.dataset.page);
        }

        const editBtn = e.target.closest('.edit-slot-btn');
        if(editBtn) {
            const slotNumber = parseInt(editBtn.dataset.slot);

            const name = prompt("Medicine name:");
            const total = parseInt(prompt("Total tablets:"));
            const left = parseInt(prompt("Tablets left:"));

            const schedules = [];
            while(confirm("Add schedule?")) {
                const time = prompt("Time (HH:MM)");
                const dosage = parseInt(prompt("Dosage tablets"));
                schedules.push({time, dosage});
            }

            await apiCall('/update_slot','POST',{
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
                await apiCall('/clear_slot','POST',{slot_number: slotNumber});
                refreshData();
            }
        }
    });

    /* ================= DATA LOAD ================= */

    async function refreshData() {
        if(!getAuthToken()) return;

        const [s,l,p] = await Promise.all([
            apiCall('/get_slots'),
            apiCall('/get_logs'),
            apiCall('/get_profile')
        ]);

        slots = Array.isArray(s) ? s : [];
        dispenseLogs = Array.isArray(l) ? l : [];
        if(p.email) userDetails = p;

        showPage(activePage);
    }

    async function showApp() {
        authPage.classList.add('page-hidden');
        appContainer.classList.remove('page-hidden');
        await refreshData();
    }

    function showAuth() {
        appContainer.classList.add('page-hidden');
        authPage.classList.remove('page-hidden');
    }

    const showToast = (msg, type='success') => {
        const t=document.getElementById('toast');
        t.textContent=msg;
        t.className=`bg-${type==='success'?'teal':'red'}-500 show`;
        setTimeout(()=>t.classList.remove('show'),3000);
    };

    if(getAuthToken()) showApp(); else showAuth();
});
