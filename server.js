const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); // 邮件发送
const { db, initDB } = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 模拟邮件发送器 (实际开发请配置真实 SMTP) ---
const sendNotification = async (user, contact, message) => {
    // 这里模拟发送，实际会打印日志
    console.log(`
    [📧 邮件/短信模拟] 
    To: ${contact.contact_info}
    Subject: 活着么 - 紧急提醒
    Body: 您的亲友 ${user.username} 已经超过 24 小时没有签到了。
    最后状态：${message || '未知'}
    `);
    
    // 真实环境示例:
    // let transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({ ... });
};

// --- API 接口 ---

// 1. 注册
app.post('/api/register', (req, res) => {
    const { username, password, phone } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.run(`INSERT INTO users (username, password, phone) VALUES (?, ?, ?)`, 
        [username, hashedPassword, phone], 
        function(err) {
            if (err) return res.status(500).json({ error: '用户已存在' });
            res.json({ id: this.lastID });
        }
    );
});

// 2. 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ id: user.id, username: user.username });
    });
});

// 3. 签到
app.post('/api/checkin', (req, res) => {
    const { userId, status, message, date } = req.body; // date 可选用于补签
    const checkinDate = date || new Date().toISOString().split('T')[0];
    const checkinTime = new Date().toISOString();

    // 检查今天是否已签到
    db.get(`SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?`, [userId, checkinDate], (err, row) => {
        if (row) return res.status(400).json({ error: '今日已签到' });

        db.run(`INSERT INTO checkins (user_id, status, message, checkin_date, checkin_time) VALUES (?, ?, ?, ?, ?)`,
            [userId, status, message, checkinDate, checkinTime],
            function(err) {
                res.json({ success: true, id: this.lastID });
            }
        );
    });
});

// 4. 获取用户数据 (最近7天记录)
app.get('/api/dashboard/:userId', (req, res) => {
    const userId = req.params.userId;
    
    // 获取最近7天数据
    const sql = `SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 7`;
    db.all(sql, [userId], (err, rows) => {
        // 计算连续签到天数 (简单逻辑：倒序遍历)
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        
        // 简化版 streak 计算：只要有记录就算
        streak = rows.length; 
        
        // 判断今日是否签到
        const todayChecked = rows.some(r => r.checkin_date === today);

        res.json({ history: rows, streak: streak, todayChecked: todayChecked });
    });
});

// 5. 亲友管理
app.post('/api/contacts', (req, res) => {
    const { userId, contactInfo, type } = req.body;
    db.run(`INSERT INTO contacts (user_id, contact_info, type) VALUES (?, ?, ?)`, 
        [userId, contactInfo, type], (err) => {
            res.json({ success: true });
        }
    );
});

app.get('/api/contacts/:userId', (req, res) => {
    db.all(`SELECT * FROM contacts WHERE user_id = ?`, [req.params.userId], (err, rows) => {
        res.json(rows);
    });
});

// --- 定时任务：心跳检测 (每分钟检查一次) ---
// 实际生产环境建议使用 node-cron
setInterval(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`[❤️ Heartbeat] Checking inactive users since ${dateStr}...`);

    // 找出昨天签到了，但今天还没签到的用户
    // 1. 找出所有昨天签到的用户
    db.all(`SELECT DISTINCT user_id FROM checkins WHERE checkin_date = ?`, [dateStr], (err, yesterdayUsers) => {
        if (yesterdayUsers.length === 0) return;

        const activeUserIds = yesterdayUsers.map(u => u.user_id);
        
        // 2. 遍历这些用户，检查他们今天是否签到
        const today = new Date().toISOString().split('T')[0];
        
        activeUserIds.forEach(userId => {
            db.get(`SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?`, [userId, today], (err, row) => {
                if (!row) {
                    // 未签到！获取用户信息和最后状态，通知亲友
                    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
                        if(!user) return;
                        
                        db.get(`SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_time DESC LIMIT 1`, [userId], (err, lastStatus) => {
                            db.all(`SELECT * FROM contacts WHERE user_id = ?`, [userId], (err, contacts) => {
                                contacts.forEach(contact => {
                                    sendNotification(user, contact, lastStatus ? lastStatus.status : '未知');
                                });
                            });
                        });
                    });
                }
            });
        });
    });
}, 60000); // 每分钟执行

// 启动
initDB();
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
