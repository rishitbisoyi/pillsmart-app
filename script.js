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

    /* ================= AUTH PAGE SWITCHING ================= */

    document.getElementById('show-signup-link')?.addEventListener('click', (e)=>{
        e.preventDefault();
        loginContainer.classList.add('page-hidden');
        forgotContainer.classList.add('page-hidden');
        signupContainer.classList.remove('page-hidden');
    });

    document.getElementById('show-login-link')?.addEventListener('click', (e)=>{
        e.preventDefault();
        signupContainer.classList.add('page-hidden');
        forgotContainer.classList.add('page-hidden');
        loginContainer.classList.remove('page-hidden');
    });

    document.getElementById('forgot-password-link')?.addEventListener('click', (e)=>{
        e.preventDefault();
        loginContainer.classList.add('page-hidden');
        signupContainer.classList.add('page-hidden');
        forgotContainer.classList.remove('page-hidden');
    });

    document.getElementById('back-to-login-link')?.addEventListener('click', (e)=>{
        e.preventDefault();
        forgotContainer.classList.add('page-hidden');
        signupContainer.classList.add('page-hidden');
        loginContainer.classList.remove('page-hidden');
    });

    /* ================= PASSWORD TOGGLE ================= */

    function setupPasswordToggle(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        if (!input || !btn) return;

        btn.addEventListener('click', () => {
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('ph-eye','ph-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('ph-eye-slash','ph-eye');
            }
        });
    }

    setupPasswordToggle('login-password', 'toggle-login-pass');
    setupPasswordToggle('signup-password', 'toggle-signup-pass');

    /* ================= NAVIGATION ================= */

    const navItems = [
        {id:'dashboard',name:'Dashboard',icon:'ph-house'},
        {id:'schedule',name:'Dispenser Manager',icon:'ph-pill'},
        {id:'logs',name:'Logs / History',icon:'ph-clipboard-text'},
        {id:'alerts',name:'Alerts',icon:'ph-bell'}
    ];

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
        t.className=`fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg z-50 ${type==='success'?'bg-teal-500':'bg-red-500'}`;
        t.classList.remove('hidden');
        setTimeout(()=>t.classList.add('hidden'),3000);
    }

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

    function updateAvatar(){
        if(!avatarDiv) return;

        if(userDetails.profile_pic){
            avatarDiv.innerHTML = `<img src="${userDetails.profile_pic}" class="h-10 w-10 rounded-full object-cover">`;
        } else {
            const initials = (userDetails.name || "U")
                .split(" ")
                .map(n => n[0])
                .join("")
                .substring(0,2)
                .toUpperCase();
            avatarDiv.textContent = initials;
        }
    }

    if(avatarDiv){
        avatarDiv.addEventListener('click', () => {
            showPage('profile');
        });
    }

    /* ================= AUTH ================= */

    document.getElementById('login-form').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email=document.getElementById('login-email').value;
        const password=document.getElementById('login-password').value;
        const remember=document.getElementById('rememberMe').checked;

        const res=await apiCall('/login','POST',{email,password});
        if(res.success){
            saveAuth(res.token,res.name,res.email,remember);
            location.reload();
        } else {
            showToast(res.error||"Login failed",'error');
        }
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

    /* ================= PROFILE PAGE ================= */

    function renderProfile(){
        return `
        <div class="dashboard-card p-8 max-w-2xl space-y-6 bg-white rounded-xl shadow">

            <div class="flex flex-col items-center space-y-4">

                <div id="profile-preview"
                     class="h-28 w-28 rounded-full bg-teal-500 text-white flex items-center justify-center text-4xl font-bold cursor-pointer overflow-hidden shadow">

                     ${userDetails.profile_pic
                        ? `<img src="${userDetails.profile_pic}" class="h-full w-full object-cover">`
                        : (userDetails.name || "U")
                            .split(" ")
                            .map(n => n[0])
                            .join("")
                            .substring(0,2)
                            .toUpperCase()}
                </div>

                <p class="text-sm text-gray-500">Click photo to change</p>
                <input type="file" id="profile-pic-input" accept="image/*" class="hidden">
            </div>

            <div>
                <label class="font-semibold block mb-1">Full Name</label>
                <input id="prof-name" class="w-full p-2 border rounded"
                    value="${userDetails.name||''}">
            </div>

            <div>
                <label class="font-semibold block mb-1">Email</label>
                <input class="w-full p-2 border rounded bg-gray-100"
                    value="${userDetails.email||''}" disabled>
            </div>

            <div>
                <label class="font-semibold block mb-1">Phone</label>
                <input id="prof-phone" class="w-full p-2 border rounded"
                    value="${userDetails.phone||''}">
            </div>

            <div>
                <label class="font-semibold block mb-1">New Password</label>
                <input type="password" id="new-password" class="w-full p-2 border rounded"
                       placeholder="Leave empty if unchanged">
            </div>

            <button id="save-profile-btn" class="primary-btn w-full">Save Changes</button>
        </div>`;
    }

    function attachProfileHandlers(){
        const preview=document.getElementById('profile-preview');
        const fileInput=document.getElementById('profile-pic-input');

        preview.addEventListener('click',()=>fileInput.click());

        fileInput.addEventListener('change',(e)=>{
            const file=e.target.files[0];
            if(!file) return;

            const reader=new FileReader();
            reader.onload=(ev)=>{
                userDetails.profile_pic=ev.target.result;
                preview.innerHTML=`<img src="${ev.target.result}" class="h-full w-full object-cover">`;
                updateAvatar();
            };
            reader.readAsDataURL(file);
        });
    }

    function showPage(page){
        activePage=page;

        if(page === 'profile'){
            pageTitle.textContent = "Profile";
            pageContent.innerHTML = renderProfile();
            attachProfileHandlers();
            return;
        }

        pageTitle.textContent=navItems.find(n=>n.id===page)?.name||'PillSmart';
        updateNav();

        if(page==='dashboard') pageContent.innerHTML=`<div class="dashboard-card p-6">Welcome ${userDetails.name}</div>`;
        if(page==='schedule') pageContent.innerHTML=`<div class="dashboard-card p-6">Dispenser Manager</div>`;
        if(page==='logs') pageContent.innerHTML=`<div class="dashboard-card p-6">${dispenseLogs.map(l=>`<div class="border p-2 mb-2 rounded">Slot ${l.slot_number} - ${l.medicine_name} - ${l.time}</div>`).join('')}</div>`;
        if(page==='alerts') pageContent.innerHTML=`<div class="dashboard-card p-6"><button id="test-alert-btn" class="bg-blue-600 text-white px-4 py-2 rounded">Test Sound</button></div>`;
    }

    document.body.addEventListener('click',async(e)=>{

        if(e.target.closest('#logout-btn')) performLogout();
        if(e.target.closest('.nav-link')){e.preventDefault();showPage(e.target.closest('.nav-link').dataset.page);}
        if(e.target.closest('#profile-avatar')) showPage('profile');

        if(e.target.id==='save-profile-btn'){
            const newName=document.getElementById('prof-name').value;
            const newPhone=document.getElementById('prof-phone').value;
            const newPassword=document.getElementById('new-password').value;

            let payload={
                name:newName,
                phone:newPhone,
                profile_pic:userDetails.profile_pic
            };

            if(newPassword) payload.new_password=newPassword;

            const res = await apiCall('/update_profile','POST',payload);

            if(res.success){
                showToast("Profile Updated Successfully");
                await refreshData();
            } else {
                showToast("Update Failed",'error');
            }
        }
    });

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
