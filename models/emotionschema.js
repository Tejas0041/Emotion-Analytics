const mongoose= require('mongoose');
const Schema= mongoose.Schema;

const emotionschema= new Schema({
    happy: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 },
    fearful: { type: Number, default: 0 },
    disgusted: { type: Number, default: 0 },
    surprised: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    user: { type: String, required: true },
}, {
    timestamps: true
});

module.exports= mongoose.model('Emotion', emotionschema);