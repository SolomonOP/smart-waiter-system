const socketIO = require('socket.io');

let io;

// Store connected users by role
const connectedUsers = {
    customers: new Map(),
    chefs: new Map(),
    admins: new Map()
};

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' 
                ? process.env.BASE_URL 
                : "http://localhost:3000",
            methods: ["GET", "POST"]
        }
    });
    
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
        
        // Handle user authentication and role assignment
        socket.on('authenticate', (data) => {
            const { userId, role } = data;
            
            switch(role) {
                case 'customer':
                    connectedUsers.customers.set(userId, socket.id);
                    socket.join('customers');
                    break;
                case 'chef':
                    connectedUsers.chefs.set(userId, socket.id);
                    socket.join('chefs');
                    break;
                case 'admin':
                    connectedUsers.admins.set(userId, socket.id);
                    socket.join('admins');
                    break;
            }
            
            socket.userId = userId;
            socket.role = role;
        });
        
        // New order placed by customer
        socket.on('new-order', (orderData) => {
            console.log('New order received:', orderData);
            
            // Notify all chefs
            io.to('chefs').emit('order-notification', {
                type: 'NEW_ORDER',
                message: `New order for Table ${orderData.tableNumber}`,
                orderId: orderData.orderId,
                tableNumber: orderData.tableNumber,
                timestamp: new Date()
            });
            
            // Notify admins
            io.to('admins').emit('order-notification', {
                type: 'NEW_ORDER',
                message: `New order #${orderData.orderId} placed`,
                orderId: orderData.orderId,
                tableNumber: orderData.tableNumber,
                timestamp: new Date()
            });
        });
        
        // Order status update
        socket.on('order-status-change', (data) => {
            const { orderId, status, tableNumber } = data;
            
            // Notify customer who placed the order
            io.emit('order-status-update', {
                orderId,
                status,
                tableNumber,
                timestamp: new Date()
            });
            
            // Notify chefs and admins
            io.to('chefs').emit('order-update', {
                orderId,
                status,
                tableNumber
            });
            
            io.to('admins').emit('order-update', {
                orderId,
                status,
                tableNumber
            });
        });
        
        // Service request from customer
        socket.on('service-request', (request) => {
            console.log('Service request:', request);
            
            // Notify all chefs
            io.to('chefs').emit('service-notification', {
                type: 'SERVICE_REQUEST',
                requestType: request.type,
                tableNumber: request.tableNumber,
                message: `${getServiceName(request.type)} requested for Table ${request.tableNumber}`,
                timestamp: new Date()
            });
            
            // Notify admins
            io.to('admins').emit('service-notification', {
                type: 'SERVICE_REQUEST',
                requestType: request.type,
                tableNumber: request.tableNumber,
                message: `${getServiceName(request.type)} requested for Table ${request.tableNumber}`,
                timestamp: new Date()
            });
        });
        
        // Table status update
        socket.on('table-status-change', (data) => {
            const { tableNumber, status } = data;
            
            // Notify all admins
            io.to('admins').emit('table-update', {
                tableNumber,
                status,
                timestamp: new Date()
            });
        });
        
        // Chat message between customer and chef
        socket.on('chat-message', (data) => {
            const { from, to, message, orderId } = data;
            
            // Send to specific user based on role
            const targetSocketId = getSocketIdByUserId(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit('chat-message', {
                    from,
                    message,
                    orderId,
                    timestamp: new Date()
                });
            }
        });
        
        // Disconnect
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            
            // Remove from connected users
            if (socket.userId && socket.role) {
                switch(socket.role) {
                    case 'customer':
                        connectedUsers.customers.delete(socket.userId);
                        break;
                    case 'chef':
                        connectedUsers.chefs.delete(socket.userId);
                        break;
                    case 'admin':
                        connectedUsers.admins.delete(socket.userId);
                        break;
                }
            }
        });
    });
    
    return io;
};

// Helper functions
function getSocketIdByUserId(userId) {
    for (const [id, socketId] of connectedUsers.customers) {
        if (id === userId) return socketId;
    }
    for (const [id, socketId] of connectedUsers.chefs) {
        if (id === userId) return socketId;
    }
    for (const [id, socketId] of connectedUsers.admins) {
        if (id === userId) return socketId;
    }
    return null;
}

function getServiceName(type) {
    switch(type) {
        case 'water': return 'Water Refill';
        case 'cleaning': return 'Table Cleaning';
        case 'bill': return 'Bill Payment';
        default: return 'Service';
    }
}

module.exports = { initializeSocket };