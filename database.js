const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./huozheme.db');

const initDB = () => {
    db.serialize(() => {
        // 用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 签到记录表
        db.run(`CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            status TEXT,
            message TEXT,
            checkin_date DATE, -- YYYY-MM-DD
            checkin_time DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 亲友列表
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            contact_info TEXT,
            type TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
        
        console.log("✅ Database initialized");
    });
};

module.exports = { db, initDB };
