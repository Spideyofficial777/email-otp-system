
// server-sample.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Rate limiting for OTP and login endpoints
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many OTP requests from this IP, please try again later'
});

const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 login attempts per hour
    message: 'Too many login attempts from this IP, please try again later'
});

// In-memory database for demo purposes
const users = [];
const otpStore = {};
const adminUser = {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10)
};

// Email transporter
let transporter;
if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
} else {
    // Mock transporter for development
    transporter = {
        sendMail: (options) => {
            console.log('Mock email sent:', options);
            return Promise.resolve({
                messageId: 'mock-message-id'
            });
        }
    };
}

// Helper functions
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function generateAuthToken(user) {
    return jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
    );
}

function generateAdminToken(admin) {
    return jwt.sign(
        { email: admin.email, role: 'admin' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '8h' }
    );
}

// Routes
app.post('/send-otp', otpLimiter, async (req, res) => {
    const { email } = req.body;
    
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user already exists
    const userExists = users.some(user => user.email === email);
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    otpStore[email] = {
        otp,
        expiresAt: Date.now() + 120000 // 2 minutes
    };
    
    // Send OTP via email
    try {
        await transporter.sendMail({
            from: '"Auth System" <no-reply@authsystem.com>',
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}`,
            html: `<p>Your OTP code is: <strong>${otp}</strong></p><p>This code will expire in 2 minutes.</p>`
        });
        
        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

app.post('/verify-otp', otpLimiter, (req, res) => {
    const { email, password, otp } = req.body;
    
    // Validate inputs
    if (!isValidEmail(email) || !password || password.length < 8) {
        return res.status(400).json({ message: 'Invalid input data' });
    }
    
    // Check if OTP exists and is valid
    const storedOtp = otpStore[email];
    if (!storedOtp || storedOtp.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // Check if OTP is expired
    if (Date.now() > storedOtp.expiresAt) {
        delete otpStore[email];
        return res.status(400).json({ message: 'OTP has expired' });
    }
    
    // Create new user
    const newUser = {
        _id: Date.now().toString(),
        email,
        password: bcrypt.hashSync(password, 10),
        registered: new Date().toISOString(),
        lastLogin: null,
        isActive: true
    };
    
    users.push(newUser);
    delete otpStore[email];
    
    res.json({ message: 'Registration successful' });
});

app.post('/login', loginLimiter, (req, res) => {
    const { email, password, rememberMe } = req.body;
    
    if (!isValidEmail(email) || !password) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    
    // Generate token
    const token = generateAuthToken(user);
    
    res.json({
        message: 'Login successful',
        token,
        user: {
            email: user.email,
            lastLogin: user.lastLogin
        }
    });
});

app.post('/admin-login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    
    if (email !== adminUser.email || !bcrypt.compareSync(password, adminUser.password)) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
    }
    
    const token = generateAdminToken(adminUser);
    
    res.json({
        message: 'Admin login successful',
        token
    });
});

app.post('/verify-admin-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        res.json({ valid: true });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

app.get('/get-users', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Return users without passwords
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        
        res.json({ users: usersWithoutPasswords });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

app.get('/get-user/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const user = users.find(u => u._id === req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

app.delete('/delete-user/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const userIndex = users.findIndex(u => u._id === req.params.id);
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        users.splice(userIndex, 1);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

app.post('/resend-otp', otpLimiter, async (req, res) => {
    const { email } = req.body;
    
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user already exists
    const userExists = users.some(user => user.email === email);
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    otpStore[email] = {
        otp,
        expiresAt: Date.now() + 120000 // 2 minutes
    };
    
    // Send OTP via email
    try {
        await transporter.sendMail({
            from: '"Auth System" <no-reply@authsystem.com>',
            to: email,
            subject: 'Your New OTP Code',
            text: `Your new OTP code is: ${otp}`,
            html: `<p>Your new OTP code is: <strong>${otp}</strong></p><p>This code will expire in 2 minutes.</p>`
        });
        
        res.json({ message: 'New OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin email: ${adminUser.email}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});
