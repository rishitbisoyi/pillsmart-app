document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let slots = [];
    let dispenseLogs = [];
    let userDetails = { name: "", email: "", phone: "", profile_pic: "", custom_ringtone: "" };
    let activePage = 'dashboard';

    const authPage = document.getElementById('authPage');
    const appContainer = document.getElementById('appContainer');
    const loginContainer = document.getElementById('login-form-container');
    const signupContainer = document.getElementById('signup-form-container');
    const forgotContainer = document.getElementById('forgot-password-container');
    const pageContent = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');
    const avatarDiv = document.getElementById('profile-avatar');

    const navItems = [
        {id:'dashboard',name:'Dashboard',icon:'ph-house'},
        {id:'schedule',name:'Dispenser Manager',icon:'ph-pill'},
        {id:'logs',name:'Logs / History',icon:'ph-clipboard-text'},
        {id:'alerts',name:'Alerts',icon:'ph-bell'}
    ];

    /* ================= AUTH ================= */

    const getAuthToken = () =>
        localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    function saveAuth(token, name, email, remember){
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('authToken', token);
        storage.setItem('userName', name);
        storage.setItem('userEmail', email);
    }

    function performLogout(){
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }

    async function apiCall(endpoint, method='GET', body=null){
        const token = getAuthToken();
        const headers = {
            'Content-Type':'application/json',
            ...(token?{'Authorization':`Bearer ${token}`}:{})
        };
        const res = await fetch(`${BACKEND_URL}${endpoint}`,{
            method,
            headers,
            body: body?JSON.stringify(body):null
        });
        return await res.json();
    }

    function showToast(msg,type='success'){
        const t=document.getElementById('toast');
        t.textContent=msg;
        t.className=`bg-${type==='success'?'teal':'red'}-500 fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg show`;
        setTimeout(()=>t.classList.remove('show'),3000);
    }

    /* ================= LOGIN / SIGNUP ================= */

    document.getElementById('login-form').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email=document.getElementById('login-email').value;
        const password=document.getElementById('login-password').value;
        const remember=document.getElementById('rememberMe').checked;

        const res=await apiCall('/login','POST',{email,password});
        if(res.success){
            saveAuth(res.token,res.name,res.email,remember);
            location.reload();
        } else showToast(res.error||"Login failed",'error');
    });

    document.getElementById('signup-form').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const name=document.getElementById('signup-name').value;
        const email=document.getElementById('signup-email').value;
        const password=document.getElementById('signup-password').value;

        const res=await apiCall('/register','POST',{name,email,password});
        if(res.success){
            showToast("Registered! Please login.");
            signupContainer.classList.add('page-hidden');
            loginContainer.classList.remove('page-hidden');
        } else showToast(res.error,'error');
    });

    document.getElementById('reset-password-form').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email=document.getElementById('reset-email').value;
        const newPass=document.getElementById('reset-password').value;

        const res=await apiCall('/reset_password','POST',{email,new_password:newPass});
        if(res.success){
            showToast("Password updated!");
            forgotContainer.classList.add('page-hidden');
            loginContainer.classList.remove('page-hidden');
        } else showToast(res.error,'error');
    });

    document.body.addEventListener('click',(e)=>{
        if(e.target.closest('#show-signup-link')){
            e.preventDefault();
            loginContainer.classList.add('page-hidden');
            signupContainer.classList.remove('page-hidden');
        }
        if(e.target.closest('#show-login-link')||e.target.closest('#back-to-login-link')){
            e.preventDefault();
            signupContainer.classList.add('page-hidden');
            forgotContainer.classList.add('page-hidden');
            loginContainer.classList.remove('page-hidden');
        }
        if(e.target.closest('#forgot-password-link')){
            e.preventDefault();
            loginContainer.classList.add('page-hidden');
            forgotContainer.classList.remove('page-hidden');
        }
    });

    /* ================= NAVIGATION ================= */

    function updateNav(){
        const sidebar=document.getElementById('sidebar-nav');
        const bottom=document.getElementById('bottom-nav');
        if(!sidebar || !bottom) return;

        sidebar.innerHTML='';
        bottom.innerHTML='';

        navItems.forEach(i=>{
            const active=i.id===activePage?'bg-teal-50 text-teal-600 font-bold':'text-gray-600 hover:bg-gray-100';
            sidebar.innerHTML+=`<a href="#" data-page="${i.id}" class="nav-link flex items-center gap-3 px-6 py-3 mx-2 my-1 rounded-lg ${active}">
                <i class="ph-bold ${i.icon} text-xl"></i>${i.name}</a>`;
            bottom.innerHTML+=`<a href="#" data-page="${i.id}" class="nav-link flex flex-col items-center flex-1 py-2 ${i.id===activePage?'text-teal-600':'text-gray-500'}">
                <i class="ph-bold ${i.icon} text-2xl"></i></a>`;
        });
    }

    /* ================= SLOT MANAGER ================= */

    function renderManager(){
        return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${slots.map(slot=>`
            <div class="dashboard-card p-5 space-y-3">
                <h3 class="font-bold text-lg">Slot ${slot.slot_number}</h3>

                <input data-slot="${slot.slot_number}" 
                    class="slot-name w-full p-2 border rounded"
                    placeholder="Medicine Name" 
                    value="${slot.medicine_name||''}">

                <div class="flex gap-2">
                    <input data-slot="${slot.slot_number}" 
                        type="number" 
                        class="slot-total w-1/2 p-2 border rounded"
                        placeholder="Total" 
                        value="${slot.total_tablets||0}">

                    <input data-slot="${slot.slot_number}" 
                        type="number" 
                        class="slot-left w-1/2 p-2 border rounded"
                        placeholder="Left" 
                        value="${slot.tablets_left||0}">
                </div>

                <div>
                    ${slot.schedules.map((sc,i)=>`
                        <div class="flex justify-between bg-gray-100 p-2 rounded text-sm mb-1">
                            <span>${sc.time} (${sc.dosage})</span>
                            <button data-slot="${slot.slot_number}" 
                                data-index="${i}" 
                                class="remove-schedule text-red-500">X</button>
                        </div>
                    `).join('')}
                </div>

                <div class="flex gap-2">
                    <input type="time" 
                        data-slot="${slot.slot_number}" 
                        class="new-time border p-1 rounded flex-1">

                    <input type="number" 
                        data-slot="${slot.slot_number}" 
                        class="new-dose border p-1 rounded w-20" 
                        placeholder="Dose">

                    <button data-slot="${slot.slot_number}" 
                        class="add-schedule bg-teal-500 text-white px-2 rounded">+</button>
                </div>

                <button data-slot="${slot.slot_number}" 
                    class="save-slot primary-btn w-full">Save</button>

                <button data-slot="${slot.slot_number}" 
                    class="clear-slot bg-red-100 text-red-600 w-full py-2 rounded">Clear</button>
            </div>
            `).join('')}
        </div>`;
    }

    /* ================= PROFILE ================= */

    function updateAvatar(){
        if(!avatarDiv) return;

        if(userDetails.profile_pic){
            avatarDiv.innerHTML = `<img src="${userDetails.profile_pic}" class="h-10 w-10 rounded-full object-cover">`;
        } else {
            const name = userDetails.name || localStorage.getItem('userName') || "U";
            avatarDiv.textContent = name.charAt(0).toUpperCase();
        }
    }

    if(avatarDiv){
        avatarDiv.addEventListener('click', () => showPage('profile'));
    }

    function renderProfile(){
        return `
        <div class="dashboard-card p-8 max-w-2xl space-y-6">
            <div class="flex flex-col items-center space-y-4">
                <div id="profile-preview"
                     class="h-28 w-28 rounded-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-600 cursor-pointer overflow-hidden shadow">
                     ${userDetails.profile_pic
                        ? `<img src="${userDetails.profile_pic}" class="h-full w-full object-cover">`
                        : userDetails.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <input type="file" id="profile-pic-input" accept="image/*" class="hidden">
            </div>

            <input id="prof-name" class="w-full p-2 border rounded"
                value="${userDetails.name||''}">
            <input id="prof-phone" class="w-full p-2 border rounded"
                value="${userDetails.phone||''}">
            <input type="password" id="new-password"
                class="w-full p-2 border rounded" placeholder="New Password">
            <input type="password" id="confirm-password"
                class="w-full p-2 border rounded" placeholder="Confirm Password">

            <button id="save-profile-btn" class="primary-btn w-full">
                Save Changes
            </button>
        </div>`;
    }

    /* ================= PAGE SWITCH ================= */

    function showPage(page){
        activePage=page;

        if(page === 'profile'){
            pageTitle.textContent = "Profile";
            pageContent.innerHTML = renderProfile();
            return;
        }

        pageTitle.textContent=navItems.find(n=>n.id===page)?.name||'PillSmart';
        updateNav();

        if(page==='dashboard')
            pageContent.innerHTML=`<div class="dashboard-card p-6">Welcome ${userDetails.name}</div>`;

        if(page==='schedule')
            pageContent.innerHTML = renderManager();

        if(page==='logs')
            pageContent.innerHTML=`<div class="dashboard-card p-6">
                ${dispenseLogs.map(l=>`
                    <div class="border p-2 mb-2 rounded">
                        Slot ${l.slot_number} - ${l.medicine_name} - ${l.time}
                    </div>
                `).join('')}
            </div>`;

        if(page==='alerts')
            pageContent.innerHTML=`<div class="dashboard-card p-6">
                <button id="test-alert-btn"
                    class="bg-blue-600 text-white px-4 py-2 rounded">
                    Test Sound
                </button>
            </div>`;
    }

    /* ================= DATA LOAD ================= */

    async function refreshData(){
        const [inv,logs,profile]=await Promise.all([
            apiCall('/get_inventory'),
            apiCall('/get_logs'),
            apiCall('/get_profile')
        ]);

        slots=Array.isArray(inv)?inv:[];
        dispenseLogs=Array.isArray(logs)?logs:[];
        if(profile?.name) userDetails=profile;

        updateAvatar();
        showPage(activePage);
    }

    if(getAuthToken()){
        authPage.classList.add('page-hidden');
        appContainer.classList.remove('page-hidden');
        refreshData();
    } else {
        appContainer.classList.add('page-hidden');
        authPage.classList.remove('page-hidden');
    }

});
