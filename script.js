document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let medicines = [];
    let dispenseLogs = [];
    let dispenserInventory = []; 
    let userDetails = { name: "", email: "", phone: "", profile_pic: "", custom_ringtone: "" }; 
    let activePage = 'dashboard';

    const authPage = document.getElementById('authPage');
    const appContainer = document.getElementById('appContainer');
    const loginFormContainer = document.getElementById('login-form-container');
    const signupFormContainer = document.getElementById('signup-form-container');
    const forgotPasswordContainer = document.getElementById('forgot-password-container');

    const getAuthToken = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    const getUserProfile = () => ({
        name: localStorage.getItem('userName') || sessionStorage.getItem('userName') || "User",
        email: localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || "user@example.com"
    });

    const performLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    };

    async function apiCall(endpoint, method='GET', body=null) {
        const token = getAuthToken();
        const headers = { 'Content-Type': 'application/json', ...(token ? {'Authorization': `Bearer ${token}`} : {}) };
        try {
            const res = await fetch(`${BACKEND_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null, cache: 'no-store' });
            return await res.json();
        } catch(e) { console.error("API Error:", e); return {success:false, error:'Server Connection Failed'}; }
    }

    function togglePasswordVisibility(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        const icon = btn.querySelector('i');
        if (input.type === 'password') { input.type = 'text'; icon.classList.remove('ph-eye'); icon.classList.add('ph-eye-slash'); } 
        else { input.type = 'password'; icon.classList.remove('ph-eye-slash'); icon.classList.add('ph-eye'); }
    }

    const renderAvatar = (name, picUrl, sizeClass = "h-10 w-10 text-base") => {
        if (picUrl && picUrl.length > 50) return `<img src="${picUrl}" alt="Profile" class="${sizeClass} rounded-full object-cover border-2 border-white shadow-sm">`;
        return `<div class="${sizeClass} rounded-full bg-teal-100 flex items-center justify-center font-bold text-teal-600 border-2 border-white shadow-sm">${name ? name.charAt(0).toUpperCase() : 'U'}</div>`;
    };

    function playAlertSound() {
        const audio = new Audio();
        if (userDetails.custom_ringtone && userDetails.custom_ringtone.length > 50) {
            audio.src = userDetails.custom_ringtone;
        } else {
            audio.src = DEFAULT_RINGTONE_URL;
        }
        audio.play().catch(e => showToast("Error playing sound (check file path)", 'error'));
    }

    const renderDashboard = (medicinesData) => {
        const total = medicinesData.length;
        const completed = medicinesData.filter(m => m.status === 'Taken').length;
        const missed = medicinesData.filter(m => m.status === 'Skipped').length;
        const pending = medicinesData.filter(m => m.status === 'Pending').length;
        const completedPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const missedPercent = total > 0 ? Math.round((missed / total) * 100) : 0;

        const upcoming = medicinesData.filter(m => m.status === 'Pending').slice(0, 3).map(m => `
            <li class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div class="flex items-center gap-3"><div class="p-2 bg-teal-100 rounded-full"><i class="ph-bold ph-pill text-xl text-teal-600"></i></div><div><p class="font-semibold text-gray-800">${m.name}</p><p class="text-sm text-gray-500">${m.dosage}</p></div></div><span class="font-bold text-gray-800 text-lg">${m.time}</span>
            </li>`).join('');

        let statusMessage = `<div class="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg"><i class="ph-fill ph-info text-2xl text-blue-600"></i><div><h3 class="font-semibold text-blue-800">On Track</h3><p class="text-sm text-blue-700">${pending} pending doses.</p></div></div>`;
        if (missed > 0) statusMessage = `<div class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"><i class="ph-fill ph-warning-circle text-2xl text-red-600"></i><div><h3 class="font-semibold text-red-800">Missed Doses</h3><p class="text-sm text-red-700">You missed ${missed} doses.</p></div></div>`;
        else if (pending === 0 && total > 0) statusMessage = `<div class="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg"><i class="ph-fill ph-check-circle text-2xl text-green-600"></i><div><h3 class="font-semibold text-green-800">Complete!</h3><p class="text-sm text-green-700">All doses taken.</p></div></div>`;

        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="dashboard-card flex items-center justify-between"><div><p class="text-sm font-medium text-gray-500">Total Medicines</p><p class="text-3xl font-bold text-gray-900">${total}</p></div><i class="ph-fill ph-pill text-4xl text-teal-400"></i></div>
                <div class="dashboard-card flex flex-col items-center justify-center"><p class="text-sm font-medium text-gray-500 mb-3">Completed Today</p><div class="progress-donut" style="--progress-value: ${completedPercent}%; --progress-color: #22c55e;"><span class="progress-donut-label text-green-600">${completedPercent}%</span></div></div>
                <div class="dashboard-card flex flex-col items-center justify-center"><p class="text-sm font-medium text-gray-500 mb-3">Missed Today</p><div class="progress-donut" style="--progress-value: ${missedPercent}%; --progress-color: #ef4444;"><span class="progress-donut-label text-red-600">${missedPercent}%</span></div></div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 dashboard-card"><h2 class="text-xl font-semibold text-gray-800 mb-4">Upcoming Schedule</h2>${upcoming.length > 0 ? `<ul class="space-y-3">${upcoming}</ul>` : `<p class="text-gray-500">No pending medicines.</p>`}</div>
                <div class="dashboard-card"><h2 class="text-xl font-semibold text-gray-800 mb-4">Status</h2>${statusMessage}</div>
            </div>`;
    };

    const renderSchedulePage = (medicinesData) => {
        const scheduleRows = medicinesData.map(m => `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="py-4 px-6 font-medium text-gray-800">${m.name}</td><td class="py-4 px-6 text-gray-600">${m.dosage}</td><td class="py-4 px-6 text-gray-600">${m.time}</td>
                <td class="py-4 px-6"><span class="px-3 py-1 rounded-full text-sm font-medium ${m.status === 'Pending' ? 'bg-blue-100 text-blue-700' : (m.status === 'Taken' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}">${m.status}</span></td>
                <td class="py-4 px-6 text-right space-x-2">
                    ${m.status === 'Pending' ? `<button data-name="${m.name}" data-action="take" class="action-btn text-green-500"><i class="ph-bold ph-check-circle text-xl"></i></button><button data-name="${m.name}" data-action="skip" class="action-btn text-red-500"><i class="ph-bold ph-x-circle text-xl"></i></button>` : ''}
                    <button data-name="${m.name}" data-action="delete" class="action-btn text-gray-400 hover:text-red-600"><i class="ph-bold ph-trash text-xl"></i></button>
                </td>
            </tr>`).join('');
        
        return `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-1 dashboard-card h-fit"><h2 class="text-xl font-semibold text-gray-800 mb-4">Add Medicine</h2>
                    <form id="add-medicine-form" class="space-y-4">
                        <input type="text" id="med-name" required placeholder="Medicine Name" class="w-full p-2 border rounded">
                        <input type="text" id="med-dosage" required placeholder="Dosage" class="w-full p-2 border rounded">
                        <div class="flex gap-2"><select id="med-hour" class="p-2 border rounded flex-1">${Array.from({length:12},(_,i)=>i+1).map(h=>`<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`).join('')}</select><select id="med-minute" class="p-2 border rounded flex-1"><option>00</option><option>15</option><option>30</option><option>45</option></select><select id="med-ampm" class="p-2 border rounded flex-1"><option>AM</option><option>PM</option></select></div>
                        <button type="submit" class="primary-btn w-full">Add Schedule</button>
                    </form>
                </div>
                <div class="lg:col-span-2 dashboard-card"><h2 class="text-xl font-semibold text-gray-800 mb-4">Current Schedule</h2><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="border-b-2 bg-gray-50"><th class="py-3 px-6">Medicine</th><th class="py-3 px-6">Dosage</th><th class="py-3 px-6">Time</th><th class="py-3 px-6">Status</th><th class="py-3 px-6 text-right">Actions</th></tr></thead><tbody>${scheduleRows || `<tr><td colspan="5" class="text-center py-8">No medicines scheduled.</td></tr>`}</tbody></table></div></div>
            </div>`;
    };

    const renderLogsPage = (logsData) => {
        const logRows = logsData.map(log => `<tr class="border-b hover:bg-gray-50"><td class="py-4 px-6">${log.time}</td><td class="py-4 px-6">${log.medicine}</td><td class="py-4 px-6">${log.status}</td></tr>`).join('');
        return `<div class="dashboard-card"><div class="flex justify-between mb-4"><h2 class="text-xl font-bold">Dispensing History</h2><button id="refresh-logs-btn" class="bg-gray-100 px-4 py-2 rounded">Refresh</button></div><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="border-b-2 bg-gray-50"><th class="py-3 px-6">Time</th><th class="py-3 px-6">Medicine</th><th class="py-3 px-6">Status</th></tr></thead><tbody>${logRows || '<tr><td colspan="3" class="text-center py-8">No logs found.</td></tr>'}</tbody></table></div></div>`;
    };

    const renderAlertsPage = (medicinesData) => {
        const nextMed = medicinesData.find(m => m.status === 'Pending');
        const alertStatus = userDetails.custom_ringtone ? 
            `<span class="text-green-600 flex items-center gap-1 font-medium"><i class="ph-bold ph-check-circle"></i> Using Custom Ringtone</span>` : 
            `<span class="text-gray-500 flex items-center gap-1 font-medium"><i class="ph-bold ph-bell"></i> Using Default Beep</span>`;

        return `
            <div class="max-w-2xl mx-auto space-y-6">
                <div class="dashboard-card p-5">
                    <div class="flex items-start gap-4">
                        <div class="p-2 bg-blue-100 rounded-full mt-1"><i class="ph-fill ph-clock text-3xl text-blue-600"></i></div>
                        <div>
                            <h3 class="text-xl font-semibold text-gray-800">Next Dose Reminder</h3>
                            <p class="text-gray-600 mt-1">${nextMed ? `Your next dose of <b>${nextMed.name}</b> is at <b>${nextMed.time}</b>` : 'No pending medicines.'}</p>
                            <button id="test-alert-btn" class="mt-3 bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <i class="ph-bold ph-speaker-high"></i> Play / Test Sound
                            </button>
                        </div>
                    </div>
                </div>
                <div class="dashboard-card p-5">
                    <div class="flex items-start gap-4">
                        <div class="p-2 bg-teal-100 rounded-full mt-1"><i class="ph-fill ph-music-note text-3xl text-teal-600"></i></div>
                        <div class="w-full">
                            <h3 class="text-xl font-semibold text-gray-800">Alert Sound Settings</h3>
                            <p class="text-sm mt-1 mb-3">${alertStatus}</p>
                            <div class="border-t border-gray-200 pt-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Upload Custom Sound (MP3/WAV)</label>
                                <div class="flex gap-2 items-center">
                                    <label class="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg border border-gray-300 transition-colors flex items-center gap-2">
                                        <i class="ph-bold ph-upload-simple"></i> Choose File
                                        <input type="file" id="ringtone-upload" accept="audio/*" class="hidden">
                                    </label>
                                    <span id="ringtone-file-name" class="text-sm text-gray-500 italic">No file chosen</span>
                                </div>
                                <p class="text-xs text-gray-400 mt-2">Max size: 2MB. Please upload short clips.</p>
                                ${userDetails.custom_ringtone ? `<button id="reset-ringtone-btn" class="mt-4 text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1 border border-red-200 px-3 py-1 rounded bg-red-50"><i class="ph-bold ph-trash"></i> Reset to Default</button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    };
    
    const renderGridPage = () => {
        const inventoryRows = dispenserInventory.map(item => `<tr class="border-b"><td class="py-3 px-4 text-center">${item.slot}</td><td class="py-3 px-4">${item.name}</td><td class="py-3 px-4 text-center">${item.dosePerDay}</td><td class="py-3 px-4 text-center">${item.tabletsLeft}</td><td class="py-3 px-4">${item.food}</td></tr>`).join('');
        const slotOptions = dispenserInventory.map(item => `<option value="${item.slot}">Slot ${item.slot}</option>`).join('');
        return `<div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-1 dashboard-card h-fit"><h2 class="text-xl font-bold mb-4">Update Slot</h2><form id="update-inventory-form" class="space-y-4"><select id="inv-slot" class="w-full p-2 border rounded">${slotOptions}</select><input id="inv-name" placeholder="Name" class="w-full p-2 border rounded" required><input type="number" id="inv-dose" placeholder="Dose/Day" class="w-full p-2 border rounded" required><input type="number" id="inv-left" placeholder="Tablets Left" class="w-full p-2 border rounded" required><select id="inv-food" class="w-full p-2 border rounded"><option value="a">After food</option><option value="b">Before food</option><option value="-">No requirement</option></select><button type="submit" class="primary-btn w-full">Update Slot</button></form></div><div class="lg:col-span-2 dashboard-card"><h2 class="text-xl font-bold mb-4">Dispenser Inventory</h2><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="border-b-2 bg-gray-50"><th class="px-4 py-3">Slot</th><th class="px-4 py-3">Medicine Name</th><th class="px-4 py-3">Dose/Day</th><th class="px-4 py-3">Tablets Left</th><th class="px-4 py-3">Food Req</th></tr></thead><tbody>${inventoryRows}</tbody></table></div></div></div>`;
    };

    const renderProfilePage = () => {
        const avatarHtml = renderAvatar(userDetails.name, userDetails.profile_pic, "h-24 w-24 text-3xl");
        return `
        <div class="max-w-2xl mx-auto space-y-6">
            <div class="dashboard-card p-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Your Profile</h2>
                <form id="profile-update-form" class="space-y-6">
                    <div class="flex items-center gap-6 mb-6">
                        <div class="relative">${avatarHtml}<label for="profile-pic-upload" class="absolute bottom-0 right-0 bg-teal-600 text-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-teal-700 transition"><i class="ph-bold ph-camera"></i></label><input type="file" id="profile-pic-upload" accept="image/*" class="hidden"></div>
                        <div><p class="font-medium text-gray-800">Profile Photo</p><p class="text-sm text-gray-500">Click camera to upload.</p></div>
                    </div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" id="prof-name" value="${userDetails.name || ''}" class="w-full p-3 border rounded-lg" required></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" id="prof-email" value="${userDetails.email || ''}" class="w-full p-3 border rounded-lg bg-gray-100 text-gray-500" readonly></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="text" id="prof-phone" value="${userDetails.phone || ''}" class="w-full p-3 border rounded-lg" placeholder="No phone"></div>
                    <button type="submit" class="primary-btn w-full mt-4 flex items-center justify-center gap-2"><i class="ph-bold ph-floppy-disk"></i> Save Changes</button>
                </form>
            </div>

            <div class="dashboard-card p-8">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Security</h2>
                <form id="change-password-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                        <input type="password" id="cp-current" placeholder="Enter current password" class="w-full p-3 border rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input type="password" id="cp-new" placeholder="Enter new password" class="w-full p-3 border rounded-lg" required>
                    </div>
                    <button type="submit" class="bg-gray-800 text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-900 transition-colors w-full flex items-center justify-center gap-2">
                        <i class="ph-bold ph-lock-key"></i> Update Password
                    </button>
                </form>
            </div>
        </div>`;
    };

    const navItems = [{id:'dashboard',name:'Dashboard',icon:'ph-house'},{id:'schedule',name:'Schedule',icon:'ph-calendar-plus'},{id:'logs',name:'Logs / History',icon:'ph-clipboard-text'},{id:'alerts',name:'Alerts',icon:'ph-bell'},{id:'grid',name:'Dispenser Inventory',icon:'ph-table'}];
    const updateNavs = () => {
        const sb=document.getElementById('sidebar-nav'), mb=document.getElementById('mobile-nav-content'), bn=document.getElementById('bottom-nav');
        sb.innerHTML=''; mb.innerHTML=''; bn.innerHTML='';
        navItems.forEach(i => {
            const cls = `nav-link flex items-center gap-3 px-6 py-3 mx-2 my-1 rounded-lg ${i.id===activePage ? 'bg-teal-50 text-teal-600 font-bold' : 'text-gray-600 hover:bg-gray-100'}`;
            sb.innerHTML+=`<a href="#" data-page="${i.id}" class="${cls}"><i class="ph-bold ${i.icon} text-xl"></i>${i.name}</a>`;
            mb.innerHTML+=`<a href="#" data-page="${i.id}" class="${cls}"><i class="ph-bold ${i.icon} text-xl"></i>${i.name}</a>`;
            bn.innerHTML+=`<a href="#" data-page="${i.id}" class="nav-link flex flex-col items-center justify-center flex-1 py-2 ${i.id===activePage?'text-teal-600':'text-gray-500'}"><i class="ph-bold ${i.icon} text-2xl"></i></a>`;
        });
    };
    
    const showPage = async (pid) => {
        activePage = pid;
        document.getElementById('page-title').textContent = navItems.find(i=>i.id===pid)?.name || (pid === 'profile' ? 'My Profile' : 'PillSmart');
        let content = '';
        if(pid==='dashboard') content = renderDashboard(medicines);
        else if(pid==='schedule') content = renderSchedulePage(medicines);
        else if(pid==='logs') content = renderLogsPage(dispenseLogs);
        else if(pid==='alerts') content = renderAlertsPage(medicines);
        else if(pid==='grid') content = renderGridPage();
        else if(pid==='profile') { const res = await apiCall('/get_profile'); if(res.name) userDetails = res; content = renderProfilePage(); }
        
        else if(pid==='about-us') {
            content = `
            <div class="space-y-6">
                <div class="dashboard-card p-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">About Us</h2>
                    <p class="text-gray-600 leading-relaxed text-lg">Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text.</p>
                </div>
                <div class="dashboard-card p-8">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Our Mission</h3>
                    <p class="text-gray-600 leading-relaxed">Sample text Sample text Sample text Sample text Sample text.</p>
                </div>
            </div>`;
        }
        else if(pid==='product') {
            content = `
            <div class="space-y-6">
                <div class="dashboard-card p-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">The PillSmart Device</h2>
                    <div class="flex flex-col md:flex-row gap-8 items-center">
                         <div class="w-full md:w-1/2 h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 font-medium border-2 border-dashed border-gray-300">
                            [Image: Product Shot]
                         </div>
                         <div class="w-full md:w-1/2">
                            <p class="text-gray-600 leading-relaxed text-lg">Sample text Sample text Sample text Sample text Sample text Sample text Sample text.</p>
                         </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="dashboard-card p-6 text-center">
                        <div class="bg-teal-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><i class="ph-bold ph-lightning text-3xl text-teal-600"></i></div>
                        <h3 class="font-bold text-lg mb-2 text-gray-800">Feature 1</h3>
                        <p class="text-gray-500">Sample text Sample text Sample text</p>
                    </div>
                    <div class="dashboard-card p-6 text-center">
                        <div class="bg-teal-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><i class="ph-bold ph-wifi-high text-3xl text-teal-600"></i></div>
                        <h3 class="font-bold text-lg mb-2 text-gray-800">Feature 2</h3>
                        <p class="text-gray-500">Sample text Sample text Sample text</p>
                    </div>
                    <div class="dashboard-card p-6 text-center">
                        <div class="bg-teal-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><i class="ph-bold ph-shield-check text-3xl text-teal-600"></i></div>
                        <h3 class="font-bold text-lg mb-2 text-gray-800">Feature 3</h3>
                        <p class="text-gray-500">Sample text Sample text Sample text</p>
                    </div>
                </div>
            </div>`;
        }

        document.getElementById('page-content').innerHTML = content;
        updateNavs();

        if(pid === 'profile') {
            const fileInput = document.getElementById('profile-pic-upload');
            if(fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if(file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => { userDetails.profile_pic = ev.target.result; showPage('profile'); };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }
        if(pid === 'alerts') {
            const ringInput = document.getElementById('ringtone-upload');
            if(ringInput) {
                ringInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if(file) {
                        if(file.size > 2 * 1024 * 1024) { showToast("File too large (>2MB). Short clips only.", 'error'); return; }
                        document.getElementById('ringtone-file-name').textContent = file.name;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                            showToast("Uploading...", 'success');
                            const res = await apiCall('/update_profile', 'POST', { custom_ringtone: ev.target.result });
                            if(res.success) {
                                userDetails.custom_ringtone = ev.target.result;
                                showToast("Ringtone Saved!", 'success');
                                showPage('alerts'); // Refresh
                            } else {
                                showToast("Failed to save audio", 'error');
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }
    };

    const showToast = (msg, type='success') => { const t=document.getElementById('toast'); t.textContent=msg; t.className=`bg-${type==='success'?'teal':'red'}-500 show`; setTimeout(()=>t.classList.remove('show'),3000); };

    async function login(email, password) {
        const remember = document.getElementById('rememberMe').checked;
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        
        const res = await apiCall('/login', 'POST', {email, password});
        if(res.success) { 
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('authToken', res.token); 
            storage.setItem('userName', res.name); 
            storage.setItem('userEmail', res.email); 
            
            window.location.reload(); 
        } else { 
            if(res.error === "User not found") {
                emailInput.classList.add('input-error');
                emailInput.value = ""; 
                emailInput.placeholder = "User not found";
                passInput.value = "";
                passInput.classList.remove('input-error');
                passInput.placeholder = "";
            } else if (res.error === "Incorrect password") {
                passInput.classList.add('input-error');
                passInput.value = ""; 
                passInput.placeholder = "Incorrect Password";
                emailInput.classList.remove('input-error');
            } else {
                 showToast(res.error, 'error');
            }
        }
    }

    function clearLoginErrors() {
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if(emailInput.classList.contains('input-error')) {
            emailInput.classList.remove('input-error');
            emailInput.placeholder = "";
        }
        if(passInput.classList.contains('input-error')) {
            passInput.classList.remove('input-error');
            passInput.placeholder = "";
        }
    }

    async function refreshData() {
        if(!getAuthToken()) return;
        const [m, l, i, p] = await Promise.all([apiCall('/get_all_medicines'), apiCall('/get_logs'), apiCall('/get_inventory'), apiCall('/get_profile')]);
        medicines = Array.isArray(m) ? m : []; dispenseLogs = Array.isArray(l) ? l : []; dispenserInventory = Array.isArray(i) ? i : [];
        if(p.name) userDetails = p; 
        showPage(activePage);
    }

    async function showApp() { 
        authPage.classList.add('page-hidden'); appContainer.classList.remove('page-hidden'); 
        await refreshData(); 
        const profileBtn = document.getElementById('profile-btn-placeholder');
        if(profileBtn) profileBtn.innerHTML = renderAvatar(userDetails.name, userDetails.profile_pic, "h-10 w-10");
    }
    
    function showAuth() { 
        appContainer.classList.add('page-hidden'); 
        authPage.classList.remove('page-hidden'); 
        loginFormContainer.classList.remove('page-hidden'); 
        signupFormContainer.classList.add('page-hidden'); 
        forgotPasswordContainer.classList.add('page-hidden'); 
    }
    
    document.body.addEventListener('click', async (e) => {
        const t = e.target;
        if(t.closest('#toggle-login-pass')) togglePasswordVisibility('login-password', 'toggle-login-pass');
        if(t.closest('#toggle-signup-pass')) togglePasswordVisibility('signup-password', 'toggle-signup-pass');
        if(t.closest('#toggle-reset-pass')) togglePasswordVisibility('reset-password', 'toggle-reset-pass');

        if(t.closest('#logout-btn')) { 
            e.preventDefault(); 
            performLogout();
        }
        
        if(t.closest('#profile-btn-placeholder')) { e.preventDefault(); showPage('profile'); }
        
        if(t.closest('#show-signup-link')) { 
            e.preventDefault(); 
            loginFormContainer.classList.add('page-hidden'); 
            signupFormContainer.classList.remove('page-hidden'); 
            forgotPasswordContainer.classList.add('page-hidden');
        }
        if(t.closest('#show-login-link') || t.closest('#back-to-login-link')) { 
            e.preventDefault(); 
            loginFormContainer.classList.remove('page-hidden'); 
            signupFormContainer.classList.add('page-hidden'); 
            forgotPasswordContainer.classList.add('page-hidden');
        }
        if(t.closest('#forgot-password-link')) {
            e.preventDefault();
            loginFormContainer.classList.add('page-hidden');
            signupFormContainer.classList.add('page-hidden');
            forgotPasswordContainer.classList.remove('page-hidden');
        }

        if(t.closest('.nav-link')) { e.preventDefault(); showPage(t.closest('.nav-link').dataset.page); document.getElementById('mobile-menu').classList.add('page-hidden'); document.getElementById('mobile-sidebar').classList.add('-translate-x-full'); }
        if(t.closest('.top-nav-link')) { e.preventDefault(); showPage(t.closest('.top-nav-link').dataset.topMenu); }
        if(t.closest('#mobile-menu-btn')) { document.getElementById('mobile-menu').classList.remove('page-hidden'); document.getElementById('mobile-sidebar').classList.remove('-translate-x-full'); }
        if(t.closest('#close-menu-btn')) { document.getElementById('mobile-sidebar').classList.add('-translate-x-full'); setTimeout(()=>document.getElementById('mobile-menu').classList.add('page-hidden'),300); }
        
        if(t.closest('#test-alert-btn')) { e.preventDefault(); playAlertSound(); }
        if(t.closest('#reset-ringtone-btn')) {
            e.preventDefault();
            if(confirm("Remove custom sound and use default?")) {
                const res = await apiCall('/update_profile', 'POST', { custom_ringtone: "" });
                if(res.success) { userDetails.custom_ringtone = ""; showToast("Reset to Default", 'success'); showPage('alerts'); }
            }
        }

        const ab = t.closest('.action-btn');
        if(ab) {
            const n = ab.dataset.name, a = ab.dataset.action;
            if(a==='delete') { if(confirm(`Delete ${n}?`)) { await apiCall('/delete_medicine', 'POST', {name:n}); refreshData(); } }
            else { await apiCall('/log_dispense', 'POST', {name:n, status: a==='take'?'Taken':'Skipped'}); refreshData(); }
        }
        if(t.closest('#refresh-logs-btn')) refreshData();
    });

    document.getElementById('login-email').addEventListener('input', clearLoginErrors);
    document.getElementById('login-password').addEventListener('input', clearLoginErrors);

    document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); login(document.getElementById('login-email').value, document.getElementById('login-password').value); });
    
    document.getElementById('signup-form').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const res = await apiCall('/register', 'POST', {name:document.getElementById('signup-name').value, email:document.getElementById('signup-email').value, password:document.getElementById('signup-password').value}); 
        if(res.success) { showToast('Registered'); loginFormContainer.classList.remove('page-hidden'); signupFormContainer.classList.add('page-hidden'); } else showToast(res.error, 'error'); 
    });

    document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const newPass = document.getElementById('reset-password').value;
        const res = await apiCall('/reset_password', 'POST', { email: email, new_password: newPass });
        
        if (res.success) {
            showToast("Password updated! Please login.", 'success');
            setTimeout(() => {
                loginFormContainer.classList.remove('page-hidden');
                forgotPasswordContainer.classList.add('page-hidden');
            }, 1500);
        } else {
            showToast(res.error || "Failed to update", 'error');
        }
    });

    document.getElementById('appContainer').addEventListener('submit', async (e) => {
        if(e.target.id==='add-medicine-form') { e.preventDefault(); const h = document.getElementById('med-hour').value, m = document.getElementById('med-minute').value, ap = document.getElementById('med-ampm').value; await apiCall('/add_medicine', 'POST', {name:document.getElementById('med-name').value, dosage:document.getElementById('med-dosage').value, time:`${h}:${m} ${ap}`}); refreshData(); }
        if(e.target.id==='update-inventory-form') { e.preventDefault(); await apiCall('/update_inventory', 'POST', {slot:parseInt(document.getElementById('inv-slot').value), name:document.getElementById('inv-name').value, dosePerDay:document.getElementById('inv-dose').value, tabletsLeft:document.getElementById('inv-left').value, food:document.getElementById('inv-food').value, refillDate:'TBD'}); refreshData(); }
        if(e.target.id==='profile-update-form') { e.preventDefault(); const res = await apiCall('/update_profile', 'POST', { name: document.getElementById('prof-name').value, phone: document.getElementById('prof-phone').value, profile_pic: userDetails.profile_pic }); if(res.success) { localStorage.setItem('userName', res.name); showToast("Profile Updated!", 'success'); showApp(); } else { showToast("Update Failed", 'error'); } }
        
        if(e.target.id === 'change-password-form') {
            e.preventDefault();
            const currPass = document.getElementById('cp-current').value;
            const newPass = document.getElementById('cp-new').value;
            
            const res = await apiCall('/change_password', 'POST', { current_password: currPass, new_password: newPass });
            if(res.success) {
                showToast("Password changed! Logging out...", 'success');
                e.target.reset();
                
                setTimeout(() => {
                    performLogout();
                }, 1500);
            } else {
                showToast(res.error || "Failed to change password", 'error');
            }
        }
    });

    if(getAuthToken()) showApp(); else showAuth();
});