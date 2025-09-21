const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Use environment variable in production

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id,
            username: user.username,
            role: user.username === 'admin' ? 'admin' : 'user'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // Token is invalid or expired
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Access denied');
    }
};

module.exports = { generateToken, verifyToken, isAdmin };