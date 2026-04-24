const nodemailer = require('nodemailer');

if (!process.env.EMAIL_USER) {
    console.warn('⚠️  WARNING: EMAIL_USER not set. Email sending will fail.');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

const sendOTP = async (to, otp) => {
    if (process.env.NODE_ENV === 'test') {
        console.log(`[TEST MODE] Mock sending OTP ${otp} to ${to}`);
        return;
    }
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'Your Verification Code - Secure File Storage',
        text: `Your OTP code is: ${otp}. It will expire in 10 minutes.`
    };
    await transporter.sendMail(mailOptions);
};

const sendSecurityAlert = async (to, subject, text) => {
    if (process.env.NODE_ENV === 'test') {
        console.log(`[TEST MODE] Mock sending SECURITY ALERT to ${to}: ${subject}`);
        return;
    }
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `[Security Alert] ${subject}`,
        text,
    };
    await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP, sendSecurityAlert };
