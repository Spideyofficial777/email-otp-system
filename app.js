// app.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const otpForm = document.getElementById('otp-form');
    const loginToggle = document.getElementById('login-toggle');
    const registerToggle = document.getElementById('register-toggle');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const otpEmailDisplay = document.getElementById('otp-email-display');
    const otpInputs = document.querySelectorAll('.otp-input');
    const resendOtpBtn = document.getElementById('resend-otp');
    const countdownElement = document.getElementById('countdown');
    const notification = document.getElementById('notification');
    
    // Password toggle functionality
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
    });
    
    // Form toggle functionality
    loginToggle.addEventListener('click', () => toggleForms('login'));
    registerToggle.addEventListener('click', () => toggleForms('register'));
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForms('register');
    });
    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForms('login');
    });
    
    function toggleForms(form) {
        if (form === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            otpForm.classList.add('hidden');
            loginToggle.classList.add('active');
            registerToggle.classList.remove('active');
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            otpForm.classList.add('hidden');
            loginToggle.classList.remove('active');
            registerToggle.classList.add('active');
        }
    }
    
    // OTP input handling
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length === 1) {
                if (index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
    
    // Handle OTP paste
    otpForm.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').trim();
        if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
            for (let i = 0; i < 6; i++) {
                otpInputs[i].value = pasteData[i];
            }
            otpInputs[5].focus();
        }
    });
    
    // Register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        
        // Basic validation
        if (!validateEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        if (password.length < 8) {
            showNotification('Password must be at least 8 characters', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        try {
            // Send request to backend to send OTP
            const response = await fetch('/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show OTP form
                registerForm.classList.add('hidden');
                otpForm.classList.remove('hidden');
                otpEmailDisplay.textContent = email;
                
                // Start countdown timer
                startCountdown(120); // 2 minutes
                
                showNotification('OTP sent to your email', 'success');
            } else {
                showNotification(data.message || 'Failed to send OTP', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    });
    
    // OTP form submission
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const otp = Array.from(otpInputs).map(input => input.value).join('');
        
        if (otp.length !== 6) {
            showNotification('Please enter a 6-digit OTP', 'error');
            return;
        }
        
        try {
            const response = await fetch('/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, otp })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('Registration successful! Please login.', 'success');
                // Reset forms
                registerForm.reset();
                otpForm.reset();
                otpInputs.forEach(input => input.value = '');
                toggleForms('login');
            } else {
                showNotification(data.message || 'OTP verification failed', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    });
    
    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.querySelector('#login-form input[type="checkbox"]').checked;
        
        if (!validateEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, rememberMe })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('Login successful!', 'success');
                // Redirect to dashboard or home page
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1500);
            } else {
                showNotification(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    });
    
    // Resend OTP functionality
    resendOtpBtn.addEventListener('click', async () => {
        const email = document.getElementById('register-email').value;
        
        try {
            const response = await fetch('/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('New OTP sent to your email', 'success');
                startCountdown(120); // Reset countdown to 2 minutes
            } else {
                showNotification(data.message || 'Failed to resend OTP', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    });
    
    // Countdown timer
    function startCountdown(seconds) {
        resendOtpBtn.disabled = true;
        let remaining = seconds;
        
        const countdownInterval = setInterval(() => {
            const minutes = Math.floor(remaining / 60);
            const secs = remaining % 60;
            
            countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                resendOtpBtn.disabled = false;
                countdownElement.textContent = '00:00';
            } else {
                remaining--;
            }
        }, 1000);
    }
    
    // Notification system
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification';
        notification.classList.add(type, 'show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // Email validation
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
});
