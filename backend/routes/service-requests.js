const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Table, User } = require('../models');

// Helper functions
function getServiceTypeName(type) {
    const typeNames = {
        'water': 'Water Refill',
        'cleaning': 'Table Cleaning',
        'bill': 'Bill Payment',
        'cutlery': 'Cutlery Request',
        'napkin': 'Napkin Request',
        'extra_sauce': 'Extra Sauce',
        'other': 'Other Service',
        'chef_attention': 'Chef Attention'
    };
    return typeNames[type] || type;
}

function getServicePriority(type) {
    const priorityMap = {
        'bill': 'high',
        'chef_attention': 'high',
        'water': 'normal',
        'cleaning': 'normal',
        'other': 'low'
    };
    return priorityMap[type] || 'normal';
}

// @route   GET /api/service-requests/pending
// @desc    Get all pending service requests for chefs
// @access  Private (Chef/Admin)
router.get('/pending', auth, async (req, res) => {
    try {
        // Check if user is chef or admin
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        // Get all tables with pending service requests
        const tables = await Table.find({
            'serviceRequests.status': 'pending',
            isActive: true
        }).select('tableNumber status serviceRequests');
        
        // Extract and flatten service requests
        const serviceRequests = [];
        tables.forEach(table => {
            table.serviceRequests.forEach(request => {
                if (request.status === 'pending') {
                    serviceRequests.push({
                        _id: request._id,
                        type: request.type,
                        tableNumber: table.tableNumber,
                        description: request.description,
                        customerName: request.customerName,
                        priority: request.priority,
                        createdAt: request.createdAt,
                        tableStatus: table.status
                    });
                }
            });
        });
        
        // Sort by priority and creation time
        serviceRequests.sort((a, b) => {
            const priorityOrder = { 'urgent': 0, 'high': 1, 'normal': 2, 'low': 3 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        
        res.json({
            success: true,
            count: serviceRequests.length,
            serviceRequests: serviceRequests
        });
        
    } catch (error) {
        console.error('Get pending service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/service-requests/:requestId/acknowledge
// @desc    Acknowledge a service request (chef assigns it to themselves)
// @access  Private (Chef/Admin)
router.put('/:requestId/acknowledge', auth, async (req, res) => {
    try {
        // Check if user is chef or admin
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { requestId } = req.params;
        const { notes } = req.body;
        
        console.log(`Acknowledging service request ${requestId} by user ${req.userId}`);
        
        // Find table with this service request
        const table = await Table.findOne({
            'serviceRequests._id': requestId
        });
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find the specific service request
        const serviceRequest = table.serviceRequests.id(requestId);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Check if already acknowledged or completed
        if (serviceRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Service request is already ${serviceRequest.status}`
            });
        }
        
        // Update the service request
        serviceRequest.status = 'acknowledged';
        serviceRequest.assignedTo = req.userId;
        serviceRequest.assignedToName = req.user.firstName + ' ' + req.user.lastName;
        serviceRequest.acknowledgedAt = new Date();
        serviceRequest.updatedAt = new Date();
        
        if (notes) {
            serviceRequest.notes = notes;
        }
        
        await table.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            // Notify customer
            io.to(`table:${table.tableNumber}`).emit('service-request-acknowledged', {
                requestId: requestId,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                message: `Your ${getServiceTypeName(serviceRequest.type)} request has been acknowledged by ${serviceRequest.assignedToName}`,
                chefName: serviceRequest.assignedToName,
                status: 'acknowledged',
                timestamp: new Date().toISOString()
            });
            
            // Notify all chefs
            io.to('chef-dashboard').emit('service-request-updated', {
                requestId: requestId,
                tableNumber: table.tableNumber,
                status: 'acknowledged',
                assignedTo: serviceRequest.assignedToName,
                assignedAt: serviceRequest.acknowledgedAt
            });
        }
        
        res.json({
            success: true,
            message: 'Service request acknowledged',
            request: {
                id: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                status: serviceRequest.status,
                assignedTo: serviceRequest.assignedToName,
                acknowledgedAt: serviceRequest.acknowledgedAt
            }
        });
        
    } catch (error) {
        console.error('Acknowledge service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/service-requests/:requestId/complete
// @desc    Complete a service request
// @access  Private (Chef/Admin)
router.put('/:requestId/complete', auth, async (req, res) => {
    try {
        // Check if user is chef or admin
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { requestId } = req.params;
        const { notes } = req.body;
        
        console.log(`Completing service request ${requestId} by user ${req.userId}`);
        
        // Find table with this service request
        const table = await Table.findOne({
            'serviceRequests._id': requestId
        });
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find the specific service request
        const serviceRequest = table.serviceRequests.id(requestId);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Check if it can be completed
        if (serviceRequest.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Service request is already completed'
            });
        }
        
        // Update the service request
        serviceRequest.status = 'completed';
        serviceRequest.completedAt = new Date();
        serviceRequest.updatedAt = new Date();
        
        if (notes) {
            serviceRequest.completionNotes = notes;
        }
        
        await table.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            // Notify customer
            io.to(`table:${table.tableNumber}`).emit('service-request-completed', {
                requestId: requestId,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                message: `Your ${getServiceTypeName(serviceRequest.type)} request has been completed`,
                status: 'completed',
                completedAt: serviceRequest.completedAt,
                timestamp: new Date().toISOString()
            });
            
            // Notify all chefs to remove from their lists
            io.to('chef-dashboard').emit('service-request-removed', {
                requestId: requestId,
                tableNumber: table.tableNumber,
                type: serviceRequest.type,
                message: 'Service request completed and removed from list'
            });
        }
        
        res.json({
            success: true,
            message: 'Service request completed successfully',
            request: {
                id: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                status: serviceRequest.status,
                completedAt: serviceRequest.completedAt
            }
        });
        
    } catch (error) {
        console.error('Complete service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/service-requests/all
// @desc    Get all service requests (for admin)
// @access  Private (Admin)
router.get('/all', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        const { status, date, limit = 50 } = req.query;
        
        // Build query
        let query = {};
        if (status && status !== 'all') {
            query['serviceRequests.status'] = status;
        }
        
        // Date filtering
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query['serviceRequests.createdAt'] = { $gte: startDate, $lte: endDate };
        }
        
        const tables = await Table.find(query)
            .select('tableNumber serviceRequests')
            .sort({ 'serviceRequests.createdAt': -1 })
            .limit(parseInt(limit));
        
        // Extract and flatten service requests
        const allRequests = [];
        tables.forEach(table => {
            table.serviceRequests.forEach(request => {
                allRequests.push({
                    _id: request._id,
                    type: request.type,
                    tableNumber: table.tableNumber,
                    description: request.description,
                    customerName: request.customerName,
                    status: request.status,
                    priority: request.priority,
                    assignedTo: request.assignedTo,
                    assignedToName: request.assignedToName,
                    createdAt: request.createdAt,
                    acknowledgedAt: request.acknowledgedAt,
                    completedAt: request.completedAt
                });
            });
        });
        
        // Sort by creation time (newest first)
        allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            count: allRequests.length,
            serviceRequests: allRequests
        });
        
    } catch (error) {
        console.error('Get all service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;