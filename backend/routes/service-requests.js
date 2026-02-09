const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// @route   GET /api/service-requests/pending
// @desc    Get all pending service requests
// @access  Private (Chef/Admin)
router.get('/pending', auth, async (req, res) => {
    try {
        // Check authorization
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        // Get ServiceRequest model
        let ServiceRequestModel;
        try {
            ServiceRequestModel = mongoose.model('ServiceRequest');
        } catch (error) {
            return res.json({
                success: true,
                count: 0,
                serviceRequests: [],
                message: 'No service requests collection found'
            });
        }
        
        // Get pending service requests
        const serviceRequests = await ServiceRequestModel.find({ status: 'pending' })
            .sort({ createdAt: 1 })
            .limit(50);
        
        res.json({
            success: true,
            count: serviceRequests.length,
            serviceRequests: serviceRequests
        });
        
    } catch (error) {
        console.error('Get service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/service-requests/:id/acknowledge
// @desc    Acknowledge a service request
// @access  Private (Chef/Admin)
router.put('/:id/acknowledge', auth, async (req, res) => {
    try {
        // Check authorization
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { id } = req.params;
        
        // Get ServiceRequest model
        let ServiceRequestModel;
        try {
            ServiceRequestModel = mongoose.model('ServiceRequest');
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find and update service request
        const serviceRequest = await ServiceRequestModel.findById(id);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        serviceRequest.status = 'acknowledged';
        serviceRequest.acknowledgedBy = req.userId;
        serviceRequest.acknowledgedAt = new Date();
        await serviceRequest.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${serviceRequest.tableNumber}`).emit('service-request-acknowledged', {
                requestId: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: serviceRequest.tableNumber,
                message: `Your ${serviceRequest.type} request has been acknowledged`,
                chefName: req.user.firstName + ' ' + req.user.lastName,
                timestamp: new Date().toISOString()
            });
            
            // Notify all chefs
            io.to('role:chef').emit('service-request-updated', {
                requestId: serviceRequest._id,
                status: 'acknowledged',
                acknowledgedBy: req.user.firstName + ' ' + req.user.lastName
            });
        }
        
        res.json({
            success: true,
            message: 'Service request acknowledged',
            request: serviceRequest
        });
        
    } catch (error) {
        console.error('Acknowledge service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/service-requests/:id/complete
// @desc    Complete a service request
// @access  Private (Chef/Admin)
router.put('/:id/complete', auth, async (req, res) => {
    try {
        // Check authorization
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { id } = req.params;
        const { notes } = req.body;
        
        // Get ServiceRequest model
        let ServiceRequestModel;
        try {
            ServiceRequestModel = mongoose.model('ServiceRequest');
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find and update service request
        const serviceRequest = await ServiceRequestModel.findById(id);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        serviceRequest.status = 'completed';
        serviceRequest.completedBy = req.userId;
        serviceRequest.completedAt = new Date();
        if (notes) {
            serviceRequest.notes = notes;
        }
        await serviceRequest.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${serviceRequest.tableNumber}`).emit('service-request-completed', {
                requestId: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: serviceRequest.tableNumber,
                message: `Your ${serviceRequest.type} request has been completed`,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Service request completed',
            request: serviceRequest
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
        // Check authorization
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        // Get ServiceRequest model
        let ServiceRequestModel;
        try {
            ServiceRequestModel = mongoose.model('ServiceRequest');
        } catch (error) {
            return res.json({
                success: true,
                count: 0,
                serviceRequests: [],
                message: 'No service requests collection found'
            });
        }
        
        // Get all service requests
        const serviceRequests = await ServiceRequestModel.find()
            .sort({ createdAt: -1 })
            .limit(100);
        
        res.json({
            success: true,
            count: serviceRequests.length,
            serviceRequests: serviceRequests
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