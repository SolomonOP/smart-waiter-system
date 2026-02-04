const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Create transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_PORT === '465',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        // Verify transporter configuration
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email transporter configuration error:', error);
                console.log('⚠️  Email service will work in demo mode');
            } else {
                console.log('✅ Email service configured successfully');
            }
        });
    }
    
    async sendOrderConfirmation(order, customer) {
        try {
            const mailOptions = {
                from: `"Smart Waiter System" <${process.env.EMAIL_FROM || 'noreply@smartwaiter.com'}>`,
                to: customer.email,
                subject: `Order Confirmation - #${order.orderNumber}`,
                html: this.generateOrderConfirmationEmail(order, customer)
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('📧 Order confirmation email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending order confirmation:', error);
            return null;
        }
    }
    
    async sendOrderStatusUpdate(order, customer, oldStatus, newStatus) {
        try {
            const mailOptions = {
                from: `"Smart Waiter System" <${process.env.EMAIL_FROM || 'noreply@smartwaiter.com'}>`,
                to: customer.email,
                subject: `Order Update - #${order.orderNumber} is now ${newStatus}`,
                html: this.generateOrderStatusEmail(order, customer, oldStatus, newStatus)
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('📧 Order status update email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending order status update:', error);
            return null;
        }
    }
    
    async sendPasswordReset(email, resetToken) {
        try {
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            
            const mailOptions = {
                from: `"Smart Waiter System" <${process.env.EMAIL_FROM || 'noreply@smartwaiter.com'}>`,
                to: email,
                subject: 'Password Reset Request',
                html: this.generatePasswordResetEmail(resetUrl)
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('📧 Password reset email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending password reset email:', error);
            return null;
        }
    }
    
    async sendWelcomeEmail(user) {
        try {
            const mailOptions = {
                from: `"Smart Waiter System" <${process.env.EMAIL_FROM || 'noreply@smartwaiter.com'}>`,
                to: user.email,
                subject: 'Welcome to Smart Waiter System!',
                html: this.generateWelcomeEmail(user)
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('📧 Welcome email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return null;
        }
    }
    
    async sendDailyReport(adminEmail, reportData) {
        try {
            const mailOptions = {
                from: `"Smart Waiter System" <${process.env.EMAIL_FROM || 'noreply@smartwaiter.com'}>`,
                to: adminEmail,
                subject: `Daily Report - ${new Date().toLocaleDateString()}`,
                html: this.generateDailyReportEmail(reportData)
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('📧 Daily report email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending daily report:', error);
            return null;
        }
    }
    
    generateOrderConfirmationEmail(order, customer) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
                    .order-details { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f2f2f2; }
                    .total { font-weight: bold; font-size: 1.2em; }
                    .status { display: inline-block; padding: 5px 10px; background: #3498db; color: white; border-radius: 3px; }
                    .footer { text-align: center; margin-top: 30px; color: #777; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Order Confirmation</h1>
                </div>
                <div class="content">
                    <p>Dear ${customer.firstName} ${customer.lastName},</p>
                    <p>Thank you for your order at Smart Waiter Restaurant!</p>
                    
                    <div class="order-details">
                        <h3>Order Details</h3>
                        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                        <p><strong>Table Number:</strong> ${order.tableNumber}</p>
                        <p><strong>Order Time:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        <p><strong>Status:</strong> <span class="status">${order.status}</span></p>
                        
                        <h4>Items Ordered:</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items.map(item => `
                                    <tr>
                                        <td>${item.name}</td>
                                        <td>${item.quantity}</td>
                                        <td>$${item.price.toFixed(2)}</td>
                                        <td>$${(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div style="text-align: right;">
                            <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
                            <p>Tax (10%): $${order.tax.toFixed(2)}</p>
                            <p>Service Charge (5%): $${order.serviceCharge.toFixed(2)}</p>
                            ${order.discount > 0 ? `<p>Discount: -$${order.discount.toFixed(2)}</p>` : ''}
                            <p class="total">Total: $${order.totalAmount.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <p><strong>Estimated Preparation Time:</strong> ${order.estimatedPrepTime} minutes</p>
                    <p>You can track your order status in real-time through our website or mobile app.</p>
                    <p>Thank you for dining with us!</p>
                </div>
                <div class="footer">
                    <p>Smart Waiter Restaurant<br>
                    123 Gourmet Street, Foodville<br>
                    Phone: (555) 123-4567</p>
                    <p>This is an automated email, please do not reply.</p>
                </div>
            </body>
            </html>
        `;
    }
    
    generateOrderStatusEmail(order, customer, oldStatus, newStatus) {
        const statusColors = {
            pending: '#f39c12',
            confirmed: '#3498db',
            preparing: '#9b59b6',
            ready: '#27ae60',
            completed: '#2ecc71',
            cancelled: '#e74c3c'
        };
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${statusColors[newStatus] || '#2c3e50'}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
                    .status-change { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
                    .old-status { color: #777; text-decoration: line-through; }
                    .new-status { color: ${statusColors[newStatus] || '#2c3e50'}; font-weight: bold; font-size: 1.2em; }
                    .footer { text-align: center; margin-top: 30px; color: #777; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Order Status Update</h1>
                </div>
                <div class="content">
                    <p>Dear ${customer.firstName} ${customer.lastName},</p>
                    
                    <div class="status-change">
                        <p>Your order status has been updated:</p>
                        <p>
                            <span class="old-status">${oldStatus.toUpperCase()}</span> 
                            → 
                            <span class="new-status">${newStatus.toUpperCase()}</span>
                        </p>
                    </div>
                    
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Table Number:</strong> ${order.tableNumber}</p>
                    <p><strong>Update Time:</strong> ${new Date().toLocaleString()}</p>
                    
                    ${newStatus === 'ready' ? `
                        <p style="background: #d4edda; padding: 10px; border-radius: 5px; border-left: 4px solid #28a745;">
                            <strong>🎉 Your order is ready!</strong><br>
                            Please proceed to collect your food or wait for server assistance.
                        </p>
                    ` : ''}
                    
                    ${newStatus === 'completed' ? `
                        <p style="background: #d1ecf1; padding: 10px; border-radius: 5px; border-left: 4px solid #17a2b8;">
                            <strong>✅ Order completed!</strong><br>
                            Thank you for dining with us. We hope you enjoyed your meal!
                        </p>
                    ` : ''}
                    
                    <p>If you have any questions, please contact our staff.</p>
                </div>
                <div class="footer">
                    <p>Smart Waiter Restaurant<br>
                    This is an automated email, please do not reply.</p>
                </div>
            </body>
            </html>
        `;
    }
    
    generatePasswordResetEmail(resetUrl) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
                    .reset-button { display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; color: #777; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Password Reset</h1>
                </div>
                <div class="content">
                    <p>You requested a password reset for your Smart Waiter account.</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetUrl}" class="reset-button">Reset Your Password</a>
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 3px;">
                        ${resetUrl}
                    </p>
                    
                    <p><strong>Note:</strong> This link will expire in 1 hour.</p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>Smart Waiter System<br>
                    This is an automated email, please do not reply.</p>
                </div>
            </body>
            </html>
        `;
    }
    
    generateWelcomeEmail(user) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
                    .features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
                    .feature { background: white; padding: 10px; border-radius: 5px; text-align: center; }
                    .icon { font-size: 2em; margin-bottom: 10px; }
                    .footer { text-align: center; margin-top: 30px; color: #777; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Welcome to Smart Waiter!</h1>
                </div>
                <div class="content">
                    <p>Dear ${user.firstName} ${user.lastName},</p>
                    <p>Welcome to Smart Waiter System! We're excited to have you on board.</p>
                    
                    <div class="features">
                        <div class="feature">
                            <div class="icon">📱</div>
                            <p>Scan QR Code to Order</p>
                        </div>
                        <div class="feature">
                            <div class="icon">⚡</div>
                            <p>Real-time Order Tracking</p>
                        </div>
                        <div class="feature">
                            <div class="icon">👨‍🍳</div>
                            <p>Direct Chef Communication</p>
                        </div>
                        <div class="feature">
                            <div class="icon">💳</div>
                            <p>Easy Digital Payments</p>
                        </div>
                    </div>
                    
                    <p>With Smart Waiter, you can:</p>
                    <ul>
                        <li>Browse our digital menu with photos</li>
                        <li>Place orders directly from your table</li>
                        <li>Track your order preparation in real-time</li>
                        <li>Request service without waiting</li>
                        <li>Pay your bill digitally</li>
                    </ul>
                    
                    <p>Start by scanning the QR code on your table or visit our website.</p>
                    
                    <p>If you have any questions, our staff will be happy to assist you.</p>
                </div>
                <div class="footer">
                    <p>Smart Waiter Restaurant<br>
                    Enjoy your dining experience!</p>
                </div>
            </body>
            </html>
        `;
    }
    
    generateDailyReportEmail(reportData) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
                    .stat-card { background: white; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .stat-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
                    .stat-label { color: #777; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f2f2f2; }
                    .footer { text-align: center; margin-top: 30px; color: #777; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Daily Report - ${new Date().toLocaleDateString()}</h1>
                </div>
                <div class="content">
                    <h2>📊 Daily Summary</h2>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">$${reportData.revenue.toFixed(2)}</div>
                            <div class="stat-label">Total Revenue</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${reportData.orders}</div>
                            <div class="stat-label">Total Orders</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${reportData.customers}</div>
                            <div class="stat-label">Customers</div>
                        </div>
                    </div>
                    
                    <h3>📈 Top Selling Items</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.topItems.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>$${item.revenue.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h3>🕒 Busiest Hours</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Hour</th>
                                <th>Orders</th>
                                <th>Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.hourlyData.map(hour => `
                                <tr>
                                    <td>${hour.hour}:00</td>
                                    <td>${hour.orders}</td>
                                    <td>$${hour.revenue.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h3>🎯 Recommendations</h3>
                    <ul>
                        ${reportData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
                <div class="footer">
                    <p>Smart Waiter System - Automated Daily Report<br>
                    Generated on ${new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `;
    }
}

// Export singleton instance
module.exports = new EmailService();