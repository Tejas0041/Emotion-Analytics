const express = require('express');
const router = express.Router();
const User = require('../models/userschema');
const bcrypt = require('bcrypt');
const { generateToken } = require('../middleware/auth');

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken(user);

        // Set token in cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        if (user.username === 'admin') {
            res.redirect('/homeadmin/all');
        } else {
            res.redirect('/home');
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// Check auth status
router.get('/check-auth', verifyToken, (req, res) => {
    res.json({ authenticated: true, user: req.user });
});

module.exports = router;