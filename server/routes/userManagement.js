const express = require('express');
const { pool } = require('../utils/db');
const bcrypt = require("bcryptjs");
const router = express.Router();
const sharedState = require('./sharedState');

// login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const connection = await pool.getConnection();
        const [user] = await connection.query('SELECT * FROM users WHERE email = ?', [username]);
        if (user.length === 0) {
            connection.release();
            return res.json({ success: false, message: 'The username does not exist' });
        }
        const isPasswordValid = await bcrypt.compare(password, user[0].password);
        if (!isPasswordValid) {
            connection.release();
            return res.json({ success: false, message: 'Password is wrong' });
        }
        sharedState.setUsername(username); // save login username
        connection.release();
        return res.json({ success: true, message: 'Login successful' });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).send('Error logging in.');
    }
});

//deposit into the account
router.post('/deposit', async (req, res) => {
    const { amount } = req.body;
    const username1 = sharedState.getUsername();
    try {
        const connection = await pool.getConnection();
        // check whether the account exists
        const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [username1]);
        if (users.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        await connection.query('UPDATE users SET balance = balance + ? WHERE email = ?', [amount, username1]);

        connection.release();
        res.json({ success: true, message: `Successfully deposited $${amount} into ${username1}'s account.` });
    } catch (error) {
        console.error('Error processing deposit:', error.message);
        res.status(500).json({ success: false, message: 'Error processing deposit.' });
    }
});

//change the password
router.put('/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const username1 = sharedState.getUsername();
    try {
        const connection = await pool.getConnection();
        const [user] = await connection.query('SELECT * FROM users WHERE email = ?', [username1]);
        if (user.length === 0) {
            connection.release();
            return res.json({ success: false, message: 'User does not exist' });
        }
        const isPasswordValid = await bcrypt.compare(oldPassword, user[0].password);
        if (!isPasswordValid) {
            connection.release();
            return res.json({ success: false, message: 'Invalid old password' });
        }
        if (oldPassword === newPassword) {
            connection.release();
            return res.json({ success: false, message: 'Old and new passwords are the same' });
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await connection.query('UPDATE users SET password = ? WHERE email = ?', [hashedNewPassword, username1]);
        connection.release();
        return res.json({ success: true, message: 'Password change successful' });
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).send('Error updating password.');
    }
});
module.exports = router;

