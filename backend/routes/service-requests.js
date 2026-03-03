// backend/routes/service-requests.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { ServiceRequest, Table } = require('../models'); // Add ServiceRequest

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

// @route   GET /api/service-requests/pending
// @desc    Get all pending service requests
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
        
        console.log('Fetching pending service requests from ServiceRequest collection...');
        
        // Find all pending service requests from the dedicated collection
        const serviceRequests = await ServiceRequest.find({ 
            status: 'pending' 
        })
        .populate('table', 'tableNumber status')
        .populate('customer', 'firstName lastName email')
        .sort({ createdAt: -1 });
        
        console.log(`Found ${serviceRequests.length} pending requests`);
        
        // Format the response
        const formattedRequests = serviceRequests.map(request => ({
            _id: request._id,
            type: request.type,
            tableNumber: request.tableNumber,
            description: request.description,
            customerName: request.customerName,
            priority: request.priority || 'normal',
            status: request.status,
            createdAt: request.createdAt,
            tableStatus: request.table?.status || 'unknown'
        }));
        
        res.json({
            success: true,
            count: formattedRequests.length,
            serviceRequests: formattedRequests
        });
        
    } catch (error) {
        console.error('Get pending service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// @route   PUT /api/service-requests/:requestId/acknowledge
// @desc    Acknowledge a service request
// @access  Private (Chef/Admin)
router.put('/:requestId/acknowledge', auth, async (req, res) => {
    try {
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { requestId } = req.params;
        const { notes } = req.body;
        
        console.log(`Acknowledging service request ${requestId} by user ${req.userId}`);
        
        // Find the service request in the dedicated collection
        const serviceRequest = await ServiceRequest.findById(requestId);
        
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
        serviceRequest.notes = notes || '';
        await serviceRequest.save();
        
        // Also update in Table model for backward compatibility
        await Table.updateOne(
            { 'serviceRequests._id': requestId },
            { 
                $set: { 
                    'serviceRequests.$.status': 'acknowledged',
                    'serviceRequests.$.assignedTo': req.userId,
                    'serviceRequests.$.assignedToName': serviceRequest.assignedToName,
                    'serviceRequests.$.acknowledgedAt': new Date(),
                    'serviceRequests.$.notes': notes || ''
                }
            }
        );
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${serviceRequest.tableNumber}`).emit('service-request-acknowledged', {
                requestId: requestId,
                type: serviceRequest.type,
                tableNumber: serviceRequest.tableNumber,
                message: `Your ${getServiceTypeName(serviceRequest.type)} request has been acknowledged`,
                chefName: serviceRequest.assignedToName,
                status: 'acknowledged',
                timestamp: new Date().toISOString()
            });
            
            io.to('role:chef').emit('service-request-updated', {
                requestId: requestId,
                tableNumber: serviceRequest.tableNumber,
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
                tableNumber: serviceRequest.tableNumber,
                status: serviceRequest.status,
                assignedTo: serviceRequest.assignedToName,
                acknowledgedAt: serviceRequest.acknowledgedAt
            }
        });
        
    } catch (error) {
        console.error('Acknowledge service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// @route   PUT /api/service-requests/:requestId/complete
// @desc    Complete a service request
// @access  Private (Chef/Admin)
router.put('/:requestId/complete', auth, async (req, res) => {
    try {
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { requestId } = req.params;
        const { notes } = req.body;
        
        console.log(`Completing service request ${requestId} by user ${req.userId}`);
        
        // Find the service request in the dedicated collection
        const serviceRequest = await ServiceRequest.findById(requestId);
        
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
        serviceRequest.completionNotes = notes || '';
        await serviceRequest.save();
        
        // Also update in Table model
        await Table.updateOne(
            { 'serviceRequests._id': requestId },
            { 
                $set: { 
                    'serviceRequests.$.status': 'completed',
                    'serviceRequests.$.completedAt': new Date(),
                    'serviceRequests.$.completionNotes': notes || ''
                }
            }
        );
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${serviceRequest.tableNumber}`).emit('service-request-completed', {
                requestId: requestId,
                type: serviceRequest.type,
                tableNumber: serviceRequest.tableNumber,
                message: `Your ${getServiceTypeName(serviceRequest.type)} request has been completed`,
                status: 'completed',
                completedAt: serviceRequest.completedAt,
                timestamp: new Date().toISOString()
            });
            
            io.to('role:chef').emit('service-request-removed', {
                requestId: requestId,
                tableNumber: serviceRequest.tableNumber,
                type: serviceRequest.type,
                message: 'Service request completed'
            });
        }
        
        res.json({
            success: true,
            message: 'Service request completed successfully',
            request: {
                id: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: serviceRequest.tableNumber,
                status: serviceRequest.status,
                completedAt: serviceRequest.completedAt
            }
        });
        
    } catch (error) {
        console.error('Complete service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

module.exports = router;