const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    originalPrice: {
        type: Number,
        min: [0, 'Original price cannot be negative']
    },
    category: {
        type: String,
        enum: {
            values: ['appetizer', 'main', 'dessert', 'drink', 'soup', 'salad', 'beverage'],
            message: 'Please select a valid category'
        },
        default: 'main'
    },
    subCategory: {
        type: String,
        trim: true
    },
    image: {
        type: String,
        default: 'default-food.jpg'
    },
    images: [{
        type: String
    }],
    available: {
        type: Boolean,
        default: true
    },
    popular: {
        type: Boolean,
        default: false
    },
    spicy: {
        type: Boolean,
        default: false
    },
    vegetarian: {
        type: Boolean,
        default: false
    },
    vegan: {
        type: Boolean,
        default: false
    },
    glutenFree: {
        type: Boolean,
        default: false
    },
    ingredients: [{
        type: String,
        trim: true
    }],
    allergens: [{
        type: String,
        trim: true
    }],
    preparationTime: {
        type: Number, // in minutes
        default: 15
    },
    calories: {
        type: Number
    },
    tags: [{
        type: String,
        trim: true
    }],
    orderCount: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    chefSpecial: {
        type: Boolean,
        default: false
    },
    discount: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for discounted price
MenuItemSchema.virtual('discountedPrice').get(function() {
    if (this.discount > 0) {
        return this.price - (this.price * this.discount / 100);
    }
    return this.price;
});

// Update timestamp before saving
MenuItemSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes for better query performance
MenuItemSchema.index({ category: 1, available: 1 });
MenuItemSchema.index({ popular: 1 });
MenuItemSchema.index({ price: 1 });
MenuItemSchema.index({ createdAt: -1 });
MenuItemSchema.index({ tags: 1 });
MenuItemSchema.index({ vegetarian: 1, vegan: 1, glutenFree: 1 });

module.exports = mongoose.model('MenuItem', MenuItemSchema);