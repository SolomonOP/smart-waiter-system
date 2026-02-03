const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');
const Order = require('./models/Order');

const sampleMenuItems = [
    {
        name: 'Classic Burger',
        description: 'Juicy beef patty with lettuce, tomato, and special sauce',
        price: 12.99,
        category: 'main',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan',
        price: 9.99,
        category: 'appetizer',
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with lemon butter sauce and seasonal vegetables',
        price: 22.99,
        category: 'main',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center served with vanilla ice cream',
        price: 7.99,
        category: 'dessert',
        image: 'https://images.unsplash.com/photo-1624353365286-3f8d62dadadf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, fresh mozzarella, and basil',
        price: 14.99,
        category: 'main',
        image: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter and herbs',
        price: 5.99,
        category: 'appetizer',
        image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 4.99,
        category: 'drink',
        image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    },
    {
        name: 'Iced Tea',
        description: 'Refreshing iced tea with lemon',
        price: 3.99,
        category: 'drink',
        image: 'https://images.unsplash.com/photo-1621264968373-430b60a6c5c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true
    }
];

async function initializeDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Clear existing data
        await User.deleteMany({});
        await MenuItem.deleteMany({});
        await Table.deleteMany({});
        await Order.deleteMany({});
        
        // Create sample customer
        const customer = new User({
            firstName: 'John',
            lastName: 'Doe',
            email: 'customer@demo.com',
            phone: '555-1234',
            password: '123456',
            role: 'customer'
        });
        await customer.save();
        
        // Create sample chef (in database)
        const chefPassword = await bcrypt.hash('123456', 10);
        const chef = new User({
            firstName: 'Master',
            lastName: 'Chef',
            email: 'chef2@demo.com',
            phone: '555-5678',
            password: chefPassword,
            role: 'chef'
        });
        await chef.save();
        
        // Create sample admin (in database)
        const adminPassword = await bcrypt.hash('123456', 10);
        const admin = new User({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin2@demo.com',
            phone: '555-9012',
            password: adminPassword,
            role: 'admin'
        });
        await admin.save();
        
        // Insert sample menu items
        await MenuItem.insertMany(sampleMenuItems);
        
        // Insert sample tables (1-20)
        const tables = [];
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        for (let i = 1; i <= 20; i++) {
            const table = new Table({
                tableNumber: i,
                status: i <= 5 ? 'occupied' : 'available', // First 5 tables occupied
                capacity: Math.floor(Math.random() * 3) + 2, // 2-4 people
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${baseUrl}/table/${i}`
            });
            tables.push(table);
        }
        await Table.insertMany(tables);
        
        // Create sample orders
        const sampleOrders = [
            {
                orderNumber: 'ORD000001',
                tableNumber: 1,
                customer: customer._id,
                items: [
                    { 
                        menuItem: (await MenuItem.findOne({ name: 'Classic Burger' }))._id,
                        name: 'Classic Burger',
                        price: 12.99,
                        quantity: 2
                    },
                    { 
                        menuItem: (await MenuItem.findOne({ name: 'Fresh Orange Juice' }))._id,
                        name: 'Fresh Orange Juice',
                        price: 4.99,
                        quantity: 2
                    }
                ],
                totalAmount: (12.99 * 2) + (4.99 * 2),
                status: 'completed',
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            },
            {
                orderNumber: 'ORD000002',
                tableNumber: 2,
                customer: customer._id,
                items: [
                    { 
                        menuItem: (await MenuItem.findOne({ name: 'Grilled Salmon' }))._id,
                        name: 'Grilled Salmon',
                        price: 22.99,
                        quantity: 1
                    },
                    { 
                        menuItem: (await MenuItem.findOne({ name: 'Caesar Salad' }))._id,
                        name: 'Caesar Salad',
                        price: 9.99,
                        quantity: 1
                    }
                ],
                totalAmount: 22.99 + 9.99,
                status: 'preparing',
                assignedChef: chef._id
            }
        ];
        
        await Order.insertMany(sampleOrders);
        
        console.log('========================================');
        console.log('DATABASE INITIALIZED SUCCESSFULLY!');
        console.log('========================================');
        console.log('Demo Accounts:');
        console.log('1. Customer: email=customer@demo.com, password=123456');
        console.log('2. Chef: email=chef@demo.com, password=123456 (hardcoded)');
        console.log('3. Chef (DB): email=chef2@demo.com, password=123456');
        console.log('4. Admin: email=admin@demo.com, password=123456 (hardcoded)');
        console.log('5. Admin (DB): email=admin2@demo.com, password=123456');
        console.log('========================================');
        console.log('Total Tables: 20 (1-5 occupied)');
        console.log('Total Menu Items: 8');
        console.log('Sample Orders: 2 created');
        
        mongoose.connection.close();
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initializeDatabase();