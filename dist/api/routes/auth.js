"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pool_1 = __importDefault(require("../../db/pool"));
const config_1 = require("../../config");
const router = (0, express_1.Router)();
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        res.status(400).json({ error: 'email, password, and name are required' });
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
    }
    try {
        const hash = await bcrypt_1.default.hash(password, 10);
        const { rows } = await pool_1.default.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at', [email, hash, name]);
        const user = rows[0];
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, config_1.config.jwt.secret, {
            expiresIn: config_1.config.jwt.expiresIn,
        });
        res.status(201).json({ token, user: { id: user.id, email: user.email, name } });
    }
    catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Email already registered' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'email and password are required' });
        return;
    }
    try {
        const { rows } = await pool_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];
        if (!user || !(await bcrypt_1.default.compare(password, user.password_hash))) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, config_1.config.jwt.secret, {
            expiresIn: config_1.config.jwt.expiresIn,
        });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }
    catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map