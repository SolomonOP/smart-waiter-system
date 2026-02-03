const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

const sampleMenuItems = [
    {
        name: 'Classic Burger',
        description: 'Juicy beef patty with lettuce, tomato, and special sauce',
        price: 12.99,
        category: 'main',
        image: 'burger.jpg',
        available: true
    },
    {
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with Caesar dressing and croutons',
        price: 9.99,
        category: 'appetizer',
        image: 'salad.jpg',
        available: true
    },
    {
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with lemon butter sauce and vegetables',
        price: 22.99,
        category: 'main',
        image: 'salmon.jpg',
        available: true
    },
    {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center and vanilla ice cream',
        price: 7.99,
        category: 'dessert',
        image: 'cake.jpg',
        available: true
    },
    {
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 4.99,
        category: 'drink',
        image: 'juice.jpg',
        available: true
    }
];

const sampleTables = Array.from({ length: 20 }, (_, i) => ({
    tableNumber: i + 1,
    status: 'available',
    capacity: Math.floor(Math.random() * 3) + 2, // 2-4 people
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${process.env.BASE_URL || 'http://localhost:3000'}/table/${i + 1}`
}));

async function initializeDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Clear existing data
        await User.deleteMany({});
        await MenuItem.deleteMany({});
        await Table.deleteMany({});
        
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
        
        // Insert sample menu items
        await MenuItem.insertMany(sampleMenuItems);
        
        // Insert sample tables
        await Table.insertMany(sampleTables);
        
        console.log('Database initialized successfully!');
        console.log('Customer demo: email=customer@demo.com, password=123456');
        console.log('Chef demo: email=chef@demo.com, password=123456');
        console.log('Admin demo: email=admin@demo.com, password=123456');
        
        mongoose.connection.close();
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initializeDatabase();