const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Order = require('../models/Order');

const sampleMenuItems = [
    {
        name: 'Classic Burger',
        description: 'Juicy beef patty with lettuce, tomato, and special sauce',
        price: 12.99,
        category: 'main',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true,
        popular: true,
        preparationTime: 15,
        orderCount: 0
    },
    {
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan',
        price: 9.99,
        category: 'appetizer',
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true,
        popular: true,
        preparationTime: 10,
        orderCount: 0
    },
    {
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with lemon butter sauce and seasonal vegetables',
        price: 22.99,
        category: 'main',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true,
        preparationTime: 20,
        orderCount: 0
    },
    {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center served with vanilla ice cream',
        price: 7.99,
        category: 'dessert',
        image: 'https://images.unsplash.com/photo-1624353365286-3f8d62dadadf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true,
        popular: true,
        preparationTime: 12,
        orderCount: 0
    },
    {
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, fresh mozzarella, and basil',
        price: 14.99,
        category: 'main',
        image: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true,
        preparationTime: 18,
        orderCount: 0
    },
    {
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 4.99,
        category: 'drink',
        image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        available: true,
        preparationTime: 5,
        orderCount: 0
    }
];

async function initializeDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Clear existing data
        console.log('🧹 Clearing existing data...');
        await User.deleteMany({});
        await MenuItem.deleteMany({});
        await Table.deleteMany({});
        await Order.deleteMany({});
        
        // Create demo users
        console.log('👥 Creating demo users...');
        const hashedPassword = await bcrypt.hash(process.env.DEMO_PASSWORD || '123456', 12);
        
        const demoUsers = [
            {
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@demo.com',
                phone: '1234567890',
                password: hashedPassword,
                role: 'admin',
                isActive: true
            },
            {
                firstName: 'Master',
                lastName: 'Chef',
                email: 'chef@demo.com',
                phone: '0987654321',
                password: hashedPassword,
                role: 'chef',
                isActive: true
            },
            {
                firstName: 'John',
                lastName: 'Doe',
                email: 'customer@demo.com',
                phone: '5551234567',
                password: hashedPassword,
                role: 'customer',
                isActive: true
            }
        ];
        
        const createdUsers = await User.insertMany(demoUsers);
        console.log(`✅ Created ${createdUsers.length} demo users`);
        
        // Create menu items
        console.log('🍽️ Creating menu items...');
        const createdMenuItems = await MenuItem.insertMany(sampleMenuItems);
        console.log(`✅ Created ${createdMenuItems.length} menu items`);
        
        // Create tables
        console.log('🪑 Creating tables...');
        const baseUrl = process.env.BASE_URL || 'https://smart-waiter-frontend.onrender.com';
        const tables = [];
        
        for (let i = 1; i <= 20; i++) {
            tables.push({
                tableNumber: i,
                status: i <= 5 ? 'occupied' : 'available',
                capacity: Math.floor(Math.random() * 3) + 2,
                section: i <= 10 ? 'A' : 'B',
                location: i <= 10 ? 'Main Hall' : 'Terrace',
                isActive: true
            });
        }
        
        const createdTables = await Table.insertMany(tables);
        console.log(`✅ Created ${createdTables.length} tables`);
        
        console.log('='.repeat(50));
        console.log('🎉 DATABASE INITIALIZATION COMPLETE!');
        console.log('='.repeat(50));
        console.log('📧 Demo Accounts:');
        console.log('   Admin:    admin@demo.com / 123456');
        console.log('   Chef:     chef@demo.com / 123456');
        console.log('   Customer: customer@demo.com / 123456');
        console.log('='.repeat(50));
        console.log('📊 Statistics:');
        console.log(`   Users: ${createdUsers.length}`);
        console.log(`   Menu Items: ${createdMenuItems.length}`);
        console.log(`   Tables: ${createdTables.length}`);
        console.log('='.repeat(50));
        
        await mongoose.connection.close();
        console.log('👋 Database connection closed');
        
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;