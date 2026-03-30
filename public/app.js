let currentUser = null;
let selectedStatus = '';

// 登录/注册
async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const phone = document.getElementById('phone').value;

    if(!user || !pass) return alert('请输入账号密码');

    // 尝试登录
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: user, password: pass })
    });

    if(res.ok) {
        const data = await res.json();
        currentUser = data;
        loadDashboard();
        switchPage('home-page');
    } else {
        // 如果登录失败，尝试注册（极简逻辑）
        const resReg = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: user, password: pass, phone: phone })
        });
        if(resReg.ok) {
            alert('注册成功，请再次登录');
        } else {
            alert('登录失败');
        }
    }
}

// 加载仪表盘
async function loadDashboard() {
    const res = await fetch(`/api/dashboard/${currentUser.id}`);
    const data = await res.json();

    document.getElementById('streak-display').innerText = data.streak;

    if(data.todayChecked) {
        document.getElementById('checkin-area').innerHTML = `
            <div style="text-align:center; padding:40px; color:green;">
                <h2>✅ 今日已签到</h2>
                <p>你的家人知道你很安全。</p>
            </div>
        `;
    }

    // 加载亲友
    loadContacts();
    renderChart(data.history);
}

// 签到
function selectStatus(el, status) {
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    selectedStatus = status;
}

async function doCheckin() {
    if(!selectedStatus) return alert('请选择状态');
    const msg = document.getElementById('message').value;
    
    const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            userId: currentUser.id, 
            status: selectedStatus, 
            message: msg 
        })
    });

    if(res.ok) {
        alert('签到成功！');
        loadDashboard();
        renderHome();
    } else {
        const err = await res.json();
        alert(err.error);
    }
}

// 亲友管理
async function addContact() {
    const info = document.getElementById('new-contact').value;
    if(!info) return;
    
    await fetch('/api/contacts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId: currentUser.id, contactInfo: info, type: 'email' })
    });
    document.getElementById('new-contact').value = '';
    loadContacts();
}

async function loadContacts() {
    const res = await fetch(`/api/contacts/${currentUser.id}`);
    const list = await res.json();
    const ul = document.getElementById('contact-list');
    ul.innerHTML = list.map(c => `<li style="padding:10px; border-bottom:1px solid #eee;">👤 ${c.contact_info}</li>`).join('');
}

// 视图切换
function switchPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function switchTab(tab) {
    document.getElementById('checkin-area').style.display = 'none';
    document.getElementById('history-area').style.display = 'none';
    document.getElementById('contacts-area').style.display = 'none';
    
    if(tab === 'home') {
        document.getElementById('checkin-area').style.display = 'block';
        renderHome();
    } else if (tab === 'history') {
        document.getElementById('history-area').style.display = 'block';
    } else if (tab === 'contacts') {
        document.getElementById('contacts-area').style.display = 'block';
    }
}

function renderHome() {
    // 简单的重置 UI 逻辑，实际项目可以更优雅
    location.reload(); 
}

function logout() {
    currentUser = null;
    switchPage('login-page');
}

// 初始化补签逻辑 (此处为简化版演示)
function show补签() {
    const date = prompt("请输入补签日期 (YYYY-MM-DD):");
    if(date) {
        fetch('/api/checkin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, status: '补签', message: '补签', date: date })
        }).then(r => r.json()).then(d => {
            if(d.success) alert('补签成功');
            else alert(d.error || '补签失败');
            loadDashboard();
        });
    }
}
