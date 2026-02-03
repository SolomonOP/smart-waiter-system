const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT === '465',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    
    async sendOrderConfirmation(order, customer) {
        const mailOptions = {
            from: `"Smart Waiter System" <${process.env.EMAIL_FROM}>`,
            to: customer.email,
            subject: `Order Confirmation - #${order.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Order Confirmation</h2>
                    <p>Dear ${customer.firstName} ${customer.lastName},</p>
                    <p>Thank you for your order at Gourmet Delight!</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #e74c3c; margin-top: 0;">Order Details</h3>
                        <p><strong>Order #:</strong> ${order.orderNumber}</p>
                        <p><strong>Table #:</strong> ${order.tableNumber}</p>
                        <p><strong>Status:</strong> ${order.status}</p>
                        <p><strong>Order Time:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        
                        <h4>Items Ordered:</h4>
                        <ul>
                            ${order.items.map(item => `
                                <li>${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>
                            `).join('')}
                        </ul>
                        
                        <div style="border-top: 2px solid #dee2e6; margin-top: 20px; padding-top: 10px;">
                            <p><strong>Subtotal:</strong> $${order.totalAmount.toFixed(2)}</p>
                            <p><strong>Tax (8%):</strong> $${(order.totalAmount * 0.08).toFixed(2)}</p>
                            <h3 style="color: #2c3e50;">Total: $${(order.totalAmount * 1.08).toFixed(2)}</h3>
                        </div>
                    </div>
                    
                    <p>You can track your order status in real-time through our website.</p>
                    <p>Thank you for dining with us!</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
                        <p>Gourmet Delight Restaurant<br>
                        123 Gourmet Street, Foodville, FK 12345<br>
                        Phone: (555) 123-4567</p>
                    </div>
                </div>
            `
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
            console.log('Order confirmation email sent to:', customer.email);
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }
    
    async sendOrderReadyNotification(order, customer) {
        const mailOptions = {
            from: `"Smart Waiter System" <${process.env.EMAIL_FROM}>`,
            to: customer.email,
            subject: `Your Order is Ready! - #${order.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #28a745;">Your Order is Ready!</h2>
                    <p>Dear ${customer.firstName} ${customer.lastName},</p>
                    <p>Your order #${order.orderNumber} for Table ${order.tableNumber} is now ready to serve!</p>
                    
                    <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;">Please proceed to collect your food or wait for server assistance.</p>
                    </div>
                    
                    <p>Thank you for dining with us!</p>
                </div>
            `
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Error sending ready notification:', error);
        }
    }
    
    async sendBill(order, customer) {
        const mailOptions = {
            from: `"Smart Waiter System" <${process.env.EMAIL_FROM}>`,
            to: customer.email,
            subject: `Your Bill - Order #${order.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Your Bill</h2>
                    <p>Dear ${customer.firstName} ${customer.lastName},</p>
                    <p>Thank you for dining at Gourmet Delight!</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #e74c3c; margin-top: 0;">Bill Summary</h3>
                        <p><strong>Order #:</strong> ${order.orderNumber}</p>
                        <p><strong>Table #:</strong> ${order.tableNumber}</p>
                        <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #2c3e50; color: white;">
                                    <th style="padding: 10px; text-align: left;">Item</th>
                                    <th style="padding: 10px; text-align: center;">Qty</th>
                                    <th style="padding: 10px; text-align: right;">Price</th>
                                    <th style="padding: 10px; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items.map(item => `
                                    <tr style="border-bottom: 1px solid #dee2e6;">
                                        <td style="padding: 10px;">${item.name}</td>
                                        <td style="padding: 10px; text-align: center;">${item.quantity}</td>
                                        <td style="padding: 10px; text-align: right;">$${item.price.toFixed(2)}</td>
                                        <td style="padding: 10px; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div style="text-align: right;">
                            <p>Subtotal: $${order.totalAmount.toFixed(2)}</p>
                            <p>Tax (8%): $${(order.totalAmount * 0.08).toFixed(2)}</p>
                            <h3 style="color: #2c3e50;">Total: $${(order.totalAmount * 1.08).toFixed(2)}</h3>
                        </div>
                    </div>
                    
                    <p>We hope to see you again soon!</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
                        <p>Gourmet Delight Restaurant<br>
                        123 Gourmet Street, Foodville, FK 12345<br>
                        Phone: (555) 123-4567</p>
                    </div>
                </div>
            `
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
            console.log('Bill email sent to:', customer.email);
        } catch (error) {
            console.error('Error sending bill email:', error);
        }
    }
    
    async sendPasswordReset(email, resetToken) {
        const resetUrl = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: `"Smart Waiter System" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Password Reset</h2>
                    <p>You requested a password reset for your Smart Waiter account.</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <a href="${resetUrl}" style="background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Your Password
                        </a>
                    </div>
                    
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>This link will expire in 1 hour.</p>
                </div>
            `
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Error sending password reset email:', error);
        }
    }
}

module.exports = new EmailService();