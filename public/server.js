const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { db, initDB } = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 关键：根路径处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
  const { userId, status, message, date } = req.body;
  const checkinDate = date || new Date().toISOString().split('T')[0];
  const checkinTime = new Date().toISOString();

  db.get(`SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?`, 
    [userId, checkinDate], 
    (err, row) => {
      if (row) return res.status(400).json({ error: '今日已签到' });
      db.run(`INSERT INTO checkins (user_id, status, message, checkin_date, checkin_time) VALUES (?, ?, ?, ?, ?)`,
        [userId, status, message, checkinDate, checkinTime],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

// 4. 获取用户数据
app.get('/api/dashboard/:userId', (req, res) => {
  const userId = req.params.userId;
  const sql = `SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 7`;
  
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // 简单计算连续天数
    if (rows.length > 0) {
      // 简化逻辑：有记录就算连续
      streak = rows.length;
    }
    
    const todayChecked = rows.some(r => r.checkin_date === today);
    res.json({ history: rows, streak: streak, todayChecked: todayChecked });
  });
});

// 5. 亲友管理
app.post('/api/contacts', (req, res) => {
  const { userId, contactInfo, type } = req.body;
  db.run(`INSERT INTO contacts (user_id, contact_info, type) VALUES (?, ?, ?)`,
    [userId, contactInfo, type],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.get('/api/contacts/:userId', (req, res) => {
  db.all(`SELECT * FROM contacts WHERE user_id = ?`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- 定时任务：心跳检测 ---
setInterval(() => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`[❤️ Heartbeat] Checking inactive users since ${yesterdayStr}...`);
  
  db.all(`SELECT DISTINCT user_id FROM checkins WHERE checkin_date = ?`, [yesterdayStr], (err, yesterdayUsers) => {
    if (err || !yesterdayUsers.length) return;
    
    yesterdayUsers.forEach(u => {
      db.get(`SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?`, [u.user_id, today], (err, row) => {
        if (!row) {
          // 未签到，通知亲友
          db.get(`SELECT * FROM users WHERE id = ?`, [u.user_id], (err, user) => {
            if (!user) return;
            db.get(`SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_time DESC LIMIT 1`, [u.user_id], (err, lastStatus) => {
              db.all(`SELECT * FROM contacts WHERE user_id = ?`, [u.user_id], (err, contacts) => {
                contacts.forEach(contact => {
                  console.log(`\n🚨 [提醒] 发送至 ${contact.contact_info}: 您的亲友 ${user.username} 已超过 24 小时未签到！最后状态: ${lastStatus?.status || '未知'}\n`);
                });
              });
            });
          });
        }
      });
    });
  });
}, 60000);

// 启动
initDB();
app.listen(PORT, () => {
  console.log(`\n🚀 活着么服务已启动: http://localhost:${PORT}\n`);
});
