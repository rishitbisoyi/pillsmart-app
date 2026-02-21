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

    /* ================= NAV ITEMS (PROFILE REMOVED) ================= */

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
        t.className=`bg-${type==='success'?'teal':'red'}-500 fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg show`;
        setTimeout(()=>t.classList.remove('show'),3000);
    }

    /* ================= AVATAR ================= */

    function updateAvatar(){
        const name = userDetails.name || localStorage.getItem('userName') || "U";
        avatarDiv.textContent = name.charAt(0).toUpperCase();
    }

    avatarDiv.addEventListener('click', () => {
        showPage('profile');
    });

    /* ================= AUTH (UNCHANGED) ================= */

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

    /* ================= PROFILE PAGE ================= */

    function renderProfile(){
        return `
        <div class="dashboard-card p-6 max-w-xl space-y-6">

            <h2 class="text-xl font-bold">Profile Settings</h2>

            <div>
                <label class="font-semibold block mb-2">Change Name</label>
                <input id="prof-name" class="w-full p-2 border rounded"
                    value="${userDetails.name||''}">
            </div>

            <div>
                <label class="font-semibold block mb-2">Change Profile Picture</label>
                <input type="file" id="profile-pic-input" accept="image/*">
            </div>

            <div>
                <label class="font-semibold block mb-2">Change Password</label>
                <input type="password" id="new-password" class="w-full p-2 border rounded" placeholder="New Password">
            </div>

            <button id="save-profile-btn" class="primary-btn w-full">Save Changes</button>
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

        if(page==='schedule') pageContent.innerHTML=renderManager();
        if(page==='logs') pageContent.innerHTML=`<div class="dashboard-card p-6">${dispenseLogs.map(l=>`<div class="border p-2 mb-2 rounded">Slot ${l.slot_number} - ${l.medicine_name} - ${l.time}</div>`).join('')}</div>`;
        if(page==='alerts') pageContent.innerHTML=`<div class="dashboard-card p-6"><button id="test-alert-btn" class="bg-blue-600 text-white px-4 py-2 rounded">Test Sound</button></div>`;
        if(page==='dashboard') pageContent.innerHTML=`<div class="dashboard-card p-6">Welcome ${userDetails.name}</div>`;
    }

    /* ================= PROFILE SAVE ================= */

    document.body.addEventListener('click',async(e)=>{

        if(e.target.closest('#logout-btn')) performLogout();
        if(e.target.closest('.nav-link')){e.preventDefault();showPage(e.target.closest('.nav-link').dataset.page);}
        if(e.target.closest('#profile-avatar')) showPage('profile');

        if(e.target.id==='save-profile-btn'){
            const newName=document.getElementById('prof-name').value;
            const newPassword=document.getElementById('new-password').value;
            const fileInput=document.getElementById('profile-pic-input');

            let payload={name:newName};

            if(newPassword) payload.new_password=newPassword;

            if(fileInput.files[0]){
                const reader=new FileReader();
                reader.onload=async (ev)=>{
                    payload.profile_pic=ev.target.result;
                    await apiCall('/update_profile','POST',payload);
                    showToast("Profile Updated");
                    refreshData();
                };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                await apiCall('/update_profile','POST',payload);
                showToast("Profile Updated");
                refreshData();
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
